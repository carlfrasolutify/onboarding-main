import asyncio
import os
import re
import json
import logging
import unicodedata
from datetime import datetime
from urllib.parse import urlparse, urljoin
from flask import Flask, request, jsonify
from concurrent.futures import ThreadPoolExecutor
import requests
from bs4 import BeautifulSoup, NavigableString, Comment
from playwright.async_api import async_playwright
import uvicorn
from google.cloud import secretmanager
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload
from googleapiclient.errors import HttpError

from asgiref.wsgi import WsgiToAsgi
import time

# Konfigurer logging til standard output
logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO  # Ændret til INFO for kun nødvendige logs
)

app = Flask(__name__)
asgi_app = WsgiToAsgi(app)

# Define headers to mimic a real browser
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/116.0.0.0 Safari/537.36"
    )
}

def get_service_account_key(secret_name="serviceaccount"):
    """
    Henter service account nøgle JSON fra Google Secret Manager.
    """
    try:
        client = secretmanager.SecretManagerServiceClient()
        project_id = os.getenv("GCP_PROJECT")  # Google Cloud Project ID er auto-sat i Cloud Run
        secret_path = f"projects/{project_id}/secrets/{secret_name}/versions/latest"

        # Tilgå secret payload
        response = client.access_secret_version(name=secret_path)
        secret_payload = response.payload.data.decode("UTF-8")

        # Parse og returner JSON credentials
        return json.loads(secret_payload)
    except Exception as e:
        logging.error(f"Fejl ved hentning af service account key: {e}", exc_info=True)
        raise

def initialize_drive_api():
    """
    Initialiserer Google Drive API klienten ved hjælp af service account nøgler fra Secret Manager.
    """
    try:
        SCOPES = ['https://www.googleapis.com/auth/drive']

        # Hent service account credentials fra Secret Manager
        service_account_info = get_service_account_key()

        # Opret credentials objekt
        credentials = service_account.Credentials.from_service_account_info(service_account_info, scopes=SCOPES)
        
        # Returner Google Drive API klienten
        return build('drive', 'v3', credentials=credentials)
    except Exception as e:
        logging.error(f"Fejl ved initialisering af Google Drive API: {e}", exc_info=True)
        raise

def upload_to_drive(file_name, file_content, folder_id):
    """
    Upload en fil til Google Drive med retry logik og support for fællesdrev.
    """
    max_retries = 3
    retry_delay = 1  # sekunder

    for attempt in range(max_retries):
        try:
            drive_service = initialize_drive_api()
            # Opret en MediaInMemoryUpload til at uploade filindholdet
            media = MediaInMemoryUpload(
                file_content.encode('utf-8'),
                mimetype='text/plain',
                resumable=True  # Resumable upload support
            )
            file_metadata = {
                'name': file_name,
                'parents': [folder_id]
            }
            file = drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id',
                supportsAllDrives=True  # Understøttelse for fællesdrev
            ).execute()
            
            logging.info(f"Fil {file_name} uploadet succesfuldt. Fil ID: {file.get('id')}")
            return file.get('id')

        except HttpError as error:
            if error.resp.status in [403, 429, 500, 503]:  # Rate limit eller serverfejl
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (2 ** attempt)  # Exponential backoff
                    logging.warning(f"Retry {attempt + 1}/{max_retries} efter {wait_time}s for {file_name}")
                    time.sleep(wait_time)
                    continue
            logging.error(f"Drive API fejl: {str(error)}")
            raise
        except Exception as e:
            logging.error(f"Uventet fejl ved upload af {file_name}: {str(e)}")
            raise


def sanitize_and_validate_url(url):
    """
    Validerer og sanitiserer input URL.
    """
    if not re.match(r'^https?://', url):  # Tjek om URL starter med http:// eller https://
        logging.error(f"Invalid URL: {url}")
        return None
    return url.rstrip('/')  # Fjern trailing slashes for konsistens

class WebScraper:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')

        self.headers = HEADERS

        # Liste over filtypenavne, der skal ekskluderes fra links
        self.excluded_extensions = [
            # Billedfiler
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp',
            # Dokumentfiler
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            # Komprimerede filer
            '.zip', '.rar', '.7z', '.tar', '.gz',
            # Lydfiler
            '.mp3', '.wav', '.ogg', '.flac',
            # Videofiler
            '.mp4', '.avi', '.mkv', '.mov', '.wmv',
            # Eksekverbare filer
            '.exe', '.msi', '.bat', '.sh',
            # Web-relaterede filer
            '.css', '.js', '.json', '.xml', '.rss',
            # Fontfiler
            '.woff', '.woff2', '.ttf', '.eot', '.otf',
            # Andre relevante filtypenavne
        ]

        # Specifikke lister over klassenavne og ID'er for uønskede elementer
        self.unwanted_selectors = [
            '.cookie-banner',
            '.popup-modal',
            '.subscribe-box',
            '.scroll-button',
            '.back-to-top',
            '.advertisement',
            '.ad-banner',
            '.promo-banner',
            '.success-message.w-form-done',
            '.error-message.w-form-fail',
            '.visually-hidden',
            '.breakdance-popup-content',
            '.coi-banner__page',
            '.cookie-banner',
            '.cookie-banner__page',
            '.cookie-banner__wrapper',
            '.cookie-banner__content',
            '.cookie-banner__button',
            '.cookie-banner__link',
            '.cookie-banner__icon',
            '.cookie-banner__message',
            '.cookie-banner__close',
            '.cookie-banner__accept',
            '.cookie-banner__reject',
            '.cookie-banner__settings',
            '.cookie-banner__setting',
            '.cookie-banner__description',
            '.cookie-banner__toggle',
            '.cookie-banner__toggle-label',
            '.cookie-banner__toggle-input',
            '.cookies-popup',
            '.cookie-notice',
            '.cookie-law-info-bar',
            '#cookie-law-info-bar',
            '.cookie-consent',
            '.cookie-policy',
            '.cookie-disclaimer',
            '.cookie-accept',
            '.cookie-decline',
            '.cookie-close',
            '.cookie-settings',
            '.cookie-preferences',
            '.cookie-configuration',
            '#coi-banner-wrapper',
            '.coi-banner__wrapper',
            '#coiPage-1',
            '.coi-banner__page',
            '.coi-banner__summary',
            '.coi-banner__text',
            '.coi-banner__headline',
            '.coi-consent-banner__category-container',
            '.coi-banner__maintext',
            '.coi-banner__page-footer',
            '.coi-button-group',
            '.coi-banner-consent-group',
            '[role="dialog"][aria-modal="true"]',
            '[role="banner"]',
            '.overlay-group',
            '.cookie-bar.text--xsmall',
            '.cookiescript_badge',
            '[id="cookiescript_badge"]',
            '[id="cookiescript_injected_wrapper"]',
            '[id="cookiescript_header"]',
            # Tilføj flere kombinerede selektorer efter behov
        ]

        # Opret hovedmappe til outputfiler (brug midlertidige mapper i Cloud Run)
        self.output_dir = "/tmp/webscraping"
        os.makedirs(self.output_dir, exist_ok=True)

        # Opret separate mapper for interne og eksterne links
        self.internal_output_dir = os.path.join(self.output_dir, "interne")
        self.external_output_dir = os.path.join(self.output_dir, "eksterne")
        os.makedirs(self.internal_output_dir, exist_ok=True)
        os.makedirs(self.external_output_dir, exist_ok=True)

        # Sæt til at holde styr på allerede sete afsnit
        self.seen_paragraphs = set()

    def remove_html_comments_from_soup(self, soup):
        """
        Fjerner alle HTML kommentarer fra BeautifulSoup objektet
        """
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()
        return soup

    def remove_image_lines(self, text):
        lines = text.splitlines()
        filtered_lines = [line for line in lines if "![](" not in line]
        return "\n".join(filtered_lines)

    def clean_and_normalize(self, text):
        """
        Rens og normaliser tekst ved at fjerne uønskede tegn og normalisere Unicode.
        """
        # Fjern zero-width space og andre kontroltegn
        text = re.sub(r'[\u200B-\u200D\uFEFF]', '', text)
        # Fjern andre uønskede kontroltegn, men bevare \n og \r
        text = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]', '', text)
        # Normaliser Unicode
        return unicodedata.normalize('NFKC', text)

    def sanitize_filename(self, link):
        """
        Saniterer linket til et gyldigt filnavn.
        """
        if link.rstrip('/') == self.base_url.rstrip('/'):
            return "forside"
            
        # Remove protocol and domain
        filename = re.sub(r'^https?://(www\.)?[^/]+/', '', link)
        # Remove trailing slash
        filename = filename.rstrip('/')
        
        if not filename:
            return "forside"
            
        # Replace problematic characters but keep structure
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        # Limit length
        return filename[:255]

    def extract_calendly_urls(self, text):
        """
        Ekstrakterer Calendly URLs fra JavaScript-kode.
        """
        # Matcher både enkelt- og dobbeltanførselstegn
        calendly_pattern = re.compile(r"Calendly\.initPopupWidget\(\{url:\s*['\"]([^'\"]+)['\"]\}")
        return calendly_pattern.findall(text)

    def find_urls_in_text(self, text):
        """
        Ekstrakterer alle URLs fra en given tekst ved hjælp af regex.
        """
        # Regex for at matche URLs
        url_pattern = re.compile(
            r'(https?://[^\s\'"<>]+)', re.IGNORECASE
        )
        return url_pattern.findall(text)
    
    def remove_duplicate_paragraphs(self, text):
        paragraphs = text.split('\n\n')
        unique_paragraphs = []
        seen = set()

        for para in paragraphs:
            # Trim hvidrum og normaliser afsnittet
            para_clean = self.clean_and_normalize(para.strip())
            # Hvis afsnittet ikke er tomt og ikke er set før, tilføj det
            if para_clean and para_clean not in seen:
                unique_paragraphs.append(para)
                seen.add(para_clean)
            else:
                logging.info(f"Fjerner gentaget afsnit: {para[:30]}...")

        return '\n\n'.join(unique_paragraphs)


    async def scrape_page(self, url, filename, category):
        """
        Scraper en enkelt side og gemmer indholdet i den angivne kategori-mappe.
        """
        try:
            logging.info(f"Starter scraping af: {url} (Kategori: {category})")
            html = await self.get_page_source_with_playwright(url)

            if not html:
                logging.warning(f"Tom eller ugyldig HTML-indhold for: {url}")
                return

            # Ekstrakter Calendly URLs før parsing med BeautifulSoup
            calendly_urls = self.extract_calendly_urls(html)
            logging.info(f"Fundet {len(calendly_urls)} Calendly URL(s) i {url}")

            # Parse HTML
            soup = BeautifulSoup(html, "html.parser")
            soup = self.remove_html_comments_from_soup(soup)
            logging.info(f"Parsed HTML for: {url}")

            # Fjern uønskede elementer baseret på specifikke CSS-selektorer
            for selector in self.unwanted_selectors:
                removed_elements = soup.select(selector)
                if removed_elements:
                    logging.info(f"Fjernede {len(removed_elements)} elementer med selector '{selector}'")
                for element in removed_elements:
                    element.decompose()

            # Fjern <script> og <style> tags for at undgå JavaScript i outputtet
            removed_scripts = soup(['script', 'style'])
            logging.info(f"Fjernede {len(removed_scripts)} <script>/<style> tags")
            for script_or_style in removed_scripts:
                script_or_style.decompose()

            # Find alle produktsektioner
            # Opdater denne selector til at matche dine produktcontainere
            product_sections = soup.find_all('div', class_='product-item')  # Tilpas 'product-item' til dit website

            formatted_text = f"URL: {url}\n\n"

            if product_sections:
                logging.info(f"Fundet {len(product_sections)} produktsektioner")
                for idx, product in enumerate(product_sections, 1):
                    product_info = self.extract_product_info(product, url)
                    if product_info:
                        formatted_text += f"### Produkt {idx}\n\n"
                        formatted_text += product_info
                        formatted_text += "\n---\n\n"
            else:
                logging.info("Ingen produktsektioner fundet, bruger process_element")
                # Hvis ingen produkter findes, brug den eksisterende process_element funktion
                body = soup.find('body')
                if body:
                    self.seen_paragraphs = set()
                    formatted_text += self.process_element(body, url=url)

            logging.info(f"Formatted text for {url}:\n{formatted_text[:500]}")  # Log de første 500 tegn

            # Fjern gentagne afsnit
            formatted_text = self.remove_duplicate_paragraphs(formatted_text)
            logging.info(f"Efter fjernelse af duplikerede afsnit, længde: {len(formatted_text)} tegn")

            # Udtræk og tilføj alle links dynamisk
            all_links = set()
            for link_tag in soup.find_all('a', href=True):
                href = link_tag['href']
                if href:
                    if href.startswith('/'):
                        # Relativ URL, gør den absolut
                        href = urljoin(url, href)
                    elif href.startswith('//'):
                        # Schema-relative URL, tilføj 'https:'
                        href = 'https:' + href
                    elif not href.startswith(('http://', 'https://')):
                        # Andre relative URLs
                        href = urljoin(url, href)
                    # Tilføj linket til all_links
                    all_links.add(href)

            # Tilføj Calendly URLs
            for calendly_url in calendly_urls:
                all_links.add(calendly_url)


            # Fjern hoved-URL'en fra links hvis nødvendigt
            all_links.discard(self.base_url)

            # Kategoriser links
            internal_links_set = set()
            external_links_set = set()
            base_netloc = urlparse(self.base_url).netloc.replace('www.', '')

            # Always add base_url to internal links
            internal_links_set.add(self.base_url)

            for link in all_links:
                parsed_href = urlparse(link)
                href_domain = parsed_href.netloc.replace('www.', '')

                if href_domain == base_netloc:
                    if self.is_relevant_link(link):
                        internal_links_set.add(link)
                else:
                    if self.is_relevant_link(link):
                        external_links_set.add(link)

            # Tilføj interne links til formatted_text
            if internal_links_set:
                formatted_text += "\n\n### Interne Links\n\n"
                for internal_link in sorted(internal_links_set):  # Sorter links for konsistens
                    if internal_link.rstrip('/') == self.base_url.rstrip('/'):
                        # Special handling for base URL to show as "Forside"
                        formatted_text += f"- [Forside]({internal_link})\n"
                    else:
                        formatted_text += f"- [{internal_link}]({internal_link})\n"
                formatted_text += "\n"

            # Fjern alle forekomster af uønsket tekst generelt
            unwanted_text_pattern = re.compile(
                r'(Existing iframe|Skip to content|Back to top|Loading\.\.\.|radar_avada|Page load link|Go to Top)',
                re.IGNORECASE
            )
            formatted_text = unwanted_text_pattern.sub('', formatted_text)
            logging.info("Fjernede uønsket tekst")

            # Rens og normaliser teksten
            formatted_text = self.clean_and_normalize(formatted_text)
            formatted_text = self.remove_image_lines(formatted_text)
            logging.info("Rensede og normaliserede tekst")

            # (Valgfrit) Fjern tomme links fra den formaterede tekst
            formatted_text = re.sub(r'\[\]\(https?://[^\)]+\)', '', formatted_text)

            # Gem teksten i fil
            # Bestem hvilken mappe der skal bruges baseret på kategori
            if category == 'interne':
                target_dir = self.internal_output_dir
            elif category == 'eksterne':
                target_dir = self.external_output_dir
            else:
                target_dir = self.output_dir  # Fallback til hovedmappen

            filepath = os.path.join(target_dir, filename)
            try:
                with open(filepath, "w", encoding="utf-8") as file:
                    file.write(formatted_text)
                logging.info(f"Indhold gemt i '{filepath}' for URL: {url}")
            except Exception as e:
                logging.error(f"Fejl ved skrivning til fil: {filepath} ({e})", exc_info=True)
                raise  # Genkaste undtagelsen for at fange den i Flask

            # Rens for konsekutive gentagelser på sætningeniveau
            self.remove_consecutive_repeated_sentences(filepath)
            logging.info(f"Rensede gentagne sætninger i '{filepath}'")
        except Exception as e:
            logging.error(f"Fejl ved scraping af {url}: {e}", exc_info=True)
            raise  # Genkaste undtagelsen for at fange den i Flask

    async def get_page_source_with_playwright(self, url):
        """
        Henter sidekilden med forbedret fejlhåndtering og timeouts.
        """
        browser = None
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-software-rasterizer'
                    ]
                )
                context = await browser.new_context(
                    user_agent=HEADERS["User-Agent"],
                    viewport={'width': 1920, 'height': 1080}
                )
                page = await context.new_page()
                
                try:
                    # Forøg timeout og deaktiver resourcetimeout
                    await page.goto(
                        url, 
                        wait_until='domcontentloaded',
                        timeout=60000
                    )
                    
                    # Vent på body element som indikation på indlæst side
                    await page.wait_for_selector('body', timeout=10000)
                    
                    # Hent HTML-indhold
                    html = await page.content()
                    return html
                    
                except Exception as e:
                    logging.error(f"Fejl ved indlæsning af {url}: {str(e)}")
                    return None
                
                finally:
                    await context.close()
                    await browser.close()
                    
        except Exception as e:
            logging.error(f"Fejl ved Playwright setup: {str(e)}")
            if browser:
                await browser.close()
            return None

    def extract_product_info(self, product_element, base_url):
        try:
            # Indledende tomme strenge for hvert felt
            product_name = ''
            product_price = ''
            product_description = ''
            product_link = ''

            # Find produktlink og navn
            link_tag = product_element.find('a', href=True)
            if link_tag:
                product_link = urljoin(base_url, link_tag['href'])
                name_tag = link_tag.find('h2', class_='product-title')
                if name_tag:
                    product_name = name_tag.get_text(strip=True)
                else:
                    product_name = link_tag.get_text(strip=True)
            else:
                name_tag = product_element.find('h2', class_='product-title')
                if name_tag:
                    product_name = name_tag.get_text(strip=True)

            # Find pris
            price_tag = product_element.find('span', class_='price')
            if price_tag:
                product_price = price_tag.get_text(strip=True)

            # Find beskrivelse
            description_tag = product_element.find('p', class_='description')
            if description_tag:
                product_description = description_tag.get_text(strip=True)

            # Byg produktinformationen
            product_info = ''
            if product_name:
                if product_link:
                    product_info += f"**Navn:** [{product_name}]({product_link})\n\n"
                else:
                    product_info += f"**Navn:** {product_name}\n\n"

            if product_price:
                product_info += f"**Pris:** {product_price}\n\n"

            if product_description:
                product_info += f"**Beskrivelse:**\n{product_description}\n"

            return product_info.strip()
        except Exception as e:
            logging.error(f"Fejl ved udtrækning af produktinformation: {e}", exc_info=True)
            return ''

    def process_element(self, element, parent_bold=False, url=None):
        text = ''
        is_current_bold = parent_bold

        try:
            if isinstance(element, NavigableString):
                cleaned_text = self.clean_and_normalize(element.strip())
                return cleaned_text

            # Log element information
            logging.info(f"Behandler element: <{element.name}> med attributter {element.attrs}")

            # Check for elements with 'heading' and 'heading--small' classes
            if 'heading' in element.get('class', []) and 'heading--small' in element.get('class', []):
                heading_text = element.get_text(strip=True)
                if self.is_redundant_heading(heading_text, element):
                    logging.info(f"Removing redundant heading: {heading_text}")
                    return ''  # Skip this heading
                else:
                    # Optionally format non-redundant headings
                    text += f"{heading_text}\n\n"

            # Specifik behandling af 'a' tags uanset forælder
            if element.name == 'a':
                link_text = element.get_text(strip=True)
                link_href = element.get('href', '').strip()
                logging.info(f"Found <a> tag with text: '{link_text}' and href: '{link_href}'")

                # Ekstrakter URLs fra onclick attributten hvis href er tom eller ugyldig
                if not link_href:
                    onclick_attr = element.get('onclick', '')
                    extracted_urls = self.find_urls_in_text(onclick_attr)
                    if extracted_urls:
                        link_href = extracted_urls[0]  # Antager første URL i onclick er relevant
                        logging.info(f"Ekstrakteret URL fra onclick: {link_href}")
                if link_href and not link_href.startswith(("http://", "https://")):
                    link_href = urljoin(url, link_href)
                    logging.info(f"Sanitized href: {link_href}")
                if link_text and link_href:
                    formatted_link = f"[{link_text}]({link_href})"
                    logging.info(f"Formatted link: {formatted_link}")
                    return formatted_link
                else:
                    return ''  # Returner tom streng for tomme links

            # Identify heading tags and text-h classes
            if element.name in ["h1", "h2", "h3", "h4", "h5", "h6", "heading", "title"]:
                level = int(element.name[1]) if element.name.startswith('h') else 1
                heading_text = element.get_text(strip=True)
                if heading_text:
                    if self.is_redundant_heading(heading_text, element):
                        logging.info(f"Removing redundant heading: {heading_text}")
                        return ''  # Skip this heading
                    formatted_heading = f"{'#' * level} {heading_text}\n\n"
                    # Process siblings
                    content = ''
                    for sibling in element.find_next_siblings():
                        if sibling.name and sibling.name.startswith('h'):
                            break
                        content += self.process_element(sibling, url=url)
                    return formatted_heading + content

            # Hvis ikke en tag-baseret heading, tjek klasserne og style
            classes = element.get('class', [])
            style = element.get('style', '').lower()

            # Forbedret regex der matcher flere heading-klassenavne
            if any(re.search(r'(^h[1-6]|[-_]h[1-6]|heading[-_]?[1-6]|text[-_]h[1-6])', cls, re.I) for cls in classes):
                for cls in classes:
                    # Udvidet regex pattern der matcher:
                    # - h1-h6
                    # - text-h1, text_h1
                    # - heading1, heading-1, heading_1  
                    # - head-1, head_1
                    match = re.match(r'\b(?:(?:text|head(?:ing)?)?[-_]?h?([1-6]))\b', cls, re.I)
                    if match:
                        heading_level = int(match.group(1))
                        heading_text = element.get_text(strip=True)
                        if heading_text:
                            formatted_heading = f"{'#' * heading_level} {heading_text}\n\n"
                            # Process siblings
                            content = ''
                            for sibling in element.find_next_siblings():
                                if sibling.name and sibling.name.startswith('h'):
                                    break
                                content += self.process_element(sibling, url=url)
                            return formatted_heading + content

            # Tjek for fed tekst baseret på klasser og inline stilarter
            if any(re.search(r'\b(bold|fw-bold|font-weight)\b', cls, re.I) for cls in classes) or 'font-weight' in style:
                is_current_bold = True

            if element.name == 'p':
                paragraph_text = ''
                for child in element.children:
                    child_text = self.process_element(child, parent_bold=is_current_bold, url=url)
                    if child_text:
                        paragraph_text += child_text + ' '
                paragraph_text = paragraph_text.strip()
                if is_current_bold and not (paragraph_text.startswith("**") and paragraph_text.endswith("**")):
                    paragraph_text = f"**{paragraph_text}**"
                if paragraph_text:
                    # Trim og normaliser afsnittet
                    para_clean = self.clean_and_normalize(paragraph_text.strip())
                    if para_clean not in self.seen_paragraphs:
                        self.seen_paragraphs.add(para_clean)
                        text += paragraph_text + '\n\n'
                    else:
                        logging.info(f"Fjerner gentaget afsnit i process_element: {para_clean[:30]}...")
            elif element.name == 'li':
                li_text = ''
                for child in element.children:
                    child_text = self.process_element(child, parent_bold=is_current_bold, url=url)
                    if child_text:
                        li_text += child_text + ' '
                li_text = li_text.strip()
                if is_current_bold and not (li_text.startswith("**") and li_text.endswith("**")):
                    li_text = f"**{li_text}**"
                if li_text:
                    text += f"- {li_text}\n"

            elif element.name in ['b', 'strong']:
                bold_text = element.get_text(strip=True)
                if bold_text:
                    bold_text = self.clean_and_normalize(bold_text)
                    if not (bold_text.startswith("**") and bold_text.endswith("**")):
                        bold_text = f"**{bold_text}**"
                    text += f"{bold_text}\n\n"

            elif element.name in ['em', 'i']:
                italic_text = element.get_text(strip=True)
                if italic_text:
                    italic_text = self.clean_and_normalize(italic_text)
                    if not (italic_text.startswith("*") and italic_text.endswith("*")):
                        italic_text = f"*{italic_text}*"
                    text += f"{italic_text}\n\n"

            elif element.name in ['code', 'pre']:
                code_text = element.get_text(strip=True)
                if code_text:
                    code_text = self.clean_and_normalize(code_text)
                    text += f"`{code_text}`\n\n"

            elif element.name == 'blockquote':
                quote_text = element.get_text(strip=True)
                if quote_text:
                    quote_text = self.clean_and_normalize(quote_text)
                    quote_text = f"> {quote_text}\n\n"
                    text += quote_text

            elif element.name == 'hr':
                text += "---\n\n"

            elif element.name == 'table':
                table_text = self.convert_table_to_markdown(element)
                text += table_text + '\n\n'

            elif element.name == 'video':
                video_src = element.get('src', '').strip()
                if not video_src:
                    source = element.find('source')
                    if source:
                        video_src = source.get('src', '').strip()
                if video_src:
                    if not video_src.startswith(("http://", "https://")):
                        video_src = urljoin(url, video_src)
                    video_link = f"[Video]({video_src})\n\n"
                    text += video_link

            elif element.name == 'external-video':
                template = element.find('template')
                if template:
                    iframe = template.find('iframe')
                    if iframe and iframe.get('src'):
                        video_src = iframe['src'].strip()
                        if not video_src.startswith(("http://", "https://")):
                            video_src = urljoin(url, video_src)
                        video_link = f"[Video]({video_src})\n\n"
                        text += video_link

            elif element.name == 'br':
                text += '\n'

            else:
                # Process child elements
                for child in element.children:
                    child_text = self.process_element(child, parent_bold=is_current_bold, url=url)
                    if child_text:
                        text += child_text + ' '
                if text:
                    text = text.strip() + '\n\n'

            return text

        except Exception as e:
            logging.error(f"Fejl ved behandling af element: {e}")
            return ''

    def is_redundant_heading(self, heading_text, element):
            """
            Bestemmer om en heading er redundant baseret på dens tekst og klasser.
            """
            # Patterns for redundant headings
            redundant_patterns = [
                r'^Step\s*\d+$',
                r'^Side\s*\d+$',
                r'^Page\s*\d+$',
                r'^Trin\s*\d+$',
                r'^Kapitel\s*\d+$',
            ]

            classes = element.get('class', [])
            # Correctly check if both 'heading' and 'heading--small' are in classes
            if not ('heading' in classes and 'heading--small' in classes):
                return False

            for pattern in redundant_patterns:
                if re.match(pattern, heading_text.strip(), re.IGNORECASE):
                    return True
            return False        

    def convert_table_to_markdown(self, table):
            headers = []
            rows = []

            # Find alle header-celler
            header = table.find('thead')
            if header:
                headers = [self.clean_and_normalize(th.get_text(strip=True)) for th in header.find_all('th')]
            else:
                first_row = table.find('tr')
                if first_row:
                    headers = [self.clean_and_normalize(th.get_text(strip=True)) for th in first_row.find_all(['th', 'td'])]

            # Find alle rækker
            for tr in table.find_all('tr'):
                cells = tr.find_all(['td', 'th'])
                row = [self.clean_and_normalize(cell.get_text(strip=True)) for cell in cells]
                if row:
                    rows.append(row)

            # Hvis headers ikke er defineret, antag den første række som header
            if not headers and rows:
                headers = rows.pop(0)

            # Konstruer Markdown-tabellen
            if headers:
                header_line = "| " + " | ".join(headers) + " |"
                separator_line = "| " + " | ".join(['---'] * len(headers)) + " |"
                table_md = f"{header_line}\n{separator_line}\n"
            else:
                table_md = ""

            for row in rows:
                row_line = "| " + " | ".join(row) + " |"
                table_md += f"{row_line}\n"

            return table_md

    def remove_consecutive_repeated_sentences(self, filepath):
            """
            Fjerner kun konsekutive gentagelser af sætninger.
            """
            try:
                with open(filepath, "r", encoding="utf-8") as file:
                    lines = file.readlines()

                unique_lines = []
                previous_sentence = ""

                for line in lines:
                    # Del linjen i sætninger ved hjælp af punktum som separator
                    sentences = re.split(r'\. |\.\n', line.strip())
                    clean_sentences = []

                    for sentence in sentences:
                        sentence = sentence.strip()
                        if sentence and sentence != previous_sentence:
                            clean_sentences.append(sentence)
                            previous_sentence = sentence

                    # Sæt sætningerne sammen igen med ". " og tilføj til output
                    if clean_sentences:
                        unique_lines.append(". ".join(clean_sentences) + "\n")
                    else:
                        unique_lines.append("\n")

                # Overskriv filen med unikke sætninger
                with open(filepath, "w", encoding="utf-8") as file:
                    file.writelines(unique_lines)
                logging.info(f"Rensede gentagne sætninger i '{filepath}'")
            except Exception as e:
                logging.error(f"Fejl ved rensning af fil: {filepath} ({e})", exc_info=True)

    def is_relevant_link(self, link):
            """
            Bestemmer, om et link er relevant baseret på dets filendelse eller sti.
            """
            # Remove hash/fragment from URL before checking
            link = link.split('#')[0]
            
            # Allow the exact base URL to be scraped
            if link.rstrip('/') == self.base_url.rstrip('/'):
                # Only return True if this is the first time we're seeing the base URL
                if not hasattr(self, '_base_url_scraped'):
                    self._base_url_scraped = True
                    return True
                return False

            # Først tjek om linket indeholder nogle af de uønskede stier
            excluded_paths = (
                '/wp-content/',
                '/wp-includes/',
                '/uploads/',
                '/plugins/',
                '/themes/',
                '/css/',
                '/js/',
                '/images/',
                '/assets/',
                '/cdn-cgi/',
                '/fonts/'
            )

            if any(path in link.lower() for path in excluded_paths):
                logging.info(f"Udelukker link pga. sti: {link}")
                return False

            # Tjek for uønskede filendelser
            if any(link.lower().endswith(ext) for ext in self.excluded_extensions):
                logging.info(f"Udelukker link pga. filendelse: {link}")
                return False

            # Tillad kun links uden filendelse eller med .html/.htm
            if not re.search(r'\.\w+$', link) or link.lower().endswith(('.html', '.htm')):
                return True

            logging.info(f"Udelukker link: {link}")
            return False

    async def find_links(self, start_url):
            html = await self.get_page_source_with_playwright(start_url)
            if not html:
                return set(), set()

            soup = BeautifulSoup(html, "html.parser")
            links = soup.find_all("a", href=True)
            internal_links = set()
            external_links = set()

            base_netloc = urlparse(self.base_url).netloc.replace('www.', '')

            for link in links:
                href = link["href"].split('#')[0]  # Remove fragment
                if not href:
                    continue
            
                # Handle relative links
                if href.startswith("/"):
                    full_url = urljoin(start_url, href)
                    if self.is_relevant_link(full_url):
                        internal_links.add(full_url)
                    continue
                
                # Handle absolute links
                if href.startswith(("http://", "https://")):
                    parsed_href = urlparse(href)
                    href_domain = parsed_href.netloc.replace('www.', '')
                    
                    if href_domain == base_netloc:
                        if self.is_relevant_link(href):
                            internal_links.add(href)
                    else:
                        if self.is_relevant_link(href):
                            external_links.add(href)
                else:
                    # Handle relative links without leading /
                    full_url = urljoin(start_url, href)
                    if self.is_relevant_link(full_url):
                        internal_links.add(full_url)

            return internal_links, external_links

    async def run(self):
            try:
                # Hent alle links fra forsiden
                internal_links, external_links = await self.find_links(self.base_url)
                logging.info(f"Fundet {len(internal_links)} interne links og {len(external_links)} eksterne links.")
                print(f"Fundet {len(internal_links)} interne links og {len(external_links)} eksterne links.")

                if not internal_links and not external_links:
                    logging.warning("Ingen links fundet. Tjek `find_links` funktionen.")
                    return

                tasks = []

                # Behandl interne links
                for link in internal_links:
                    cleaned_link = self.sanitize_filename(link)
                    filename = f"{cleaned_link}.txt"
                    tasks.append(self.scrape_page(link, filename, 'interne'))

                # Behandl eksterne links
                for link in external_links:
                    cleaned_link = self.sanitize_filename(link)
                    filename = f"{cleaned_link}.txt"
                    tasks.append(self.scrape_page(link, filename, 'eksterne'))

                # Begræns antallet af samtidige opgaver
                semaphore = asyncio.Semaphore(10)

                async def sem_task(task):
                    async with semaphore:
                        await task

                await asyncio.gather(*(sem_task(task) for task in tasks), return_exceptions=True)

            except Exception as e:
                logging.error(f"Fejl i run metoden: {e}", exc_info=True)

    def get_scraped_files(self):
            """
            Returner en liste af dictionaries med 'name' og 'content'.
            """
            files = []
            # Gennemgå dine output mapper og indlæs filerne
            for category in ['interne', 'eksterne']:
                directory = os.path.join(self.output_dir, category)
                if not os.path.exists(directory):
                    continue
                for filename in os.listdir(directory):
                    filepath = os.path.join(directory, filename)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    files.append({'name': filename, 'content': content})
            return files




@app.route('/scrape', methods=['POST'])
async def scrape_website():
    """
    HTTP endpoint til at starte scraping og uploade til Google Drive.
    """
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '3600'
    }

    if request.method == 'OPTIONS':
        return ('', 204, cors_headers)

    request_json = request.get_json(silent=True)
    if not request_json or 'url' not in request_json or 'folder_id' not in request_json:
        logging.error("Invalid request: Missing 'url' or 'folder_id'")
        return jsonify({
            'error': 'Please provide a valid URL and folder_id in the request body'
        }), 400, cors_headers

    url = request_json['url']
    folder_id = request_json['folder_id']
    base_url = sanitize_and_validate_url(url)
    if not base_url:
        logging.error(f"Invalid URL provided: {url}")
        return jsonify({
            'error': 'Invalid URL provided'
        }), 400, cors_headers

    try:
        scraper = WebScraper(base_url)
        await scraper.run()  # Nu kan vi await direkte
        files = scraper.get_scraped_files()
        if not files:
            logging.warning("Ingen filer blev scraped.")
            return jsonify({
                'message': 'No files scraped.',
                'files_uploaded': 0,
                'status': 'no_files'
            }), 200, cors_headers

        # Upload scraped files til Google Drive
        for file in files:
            upload_to_drive(file['name'], file['content'], folder_id)

        # Indsæt metadata
        metadata = {
            'URL': base_url,
            'Date Scraped': datetime.utcnow().isoformat() + 'Z',
            'Total Pages': len(files)
        }
        metadata_content = '\n'.join([f"{k}: {v}" for k, v in metadata.items()])
        upload_to_drive('metadata.txt', metadata_content, folder_id)

        logging.info(f"Scraping and upload completed successfully for {base_url}")
        return jsonify({
            'url': base_url,
            'files_uploaded': len(files) + 1,
            'status': 'success'
        }), 200, cors_headers

    except Exception as e:
        logging.error(f"Error processing request for {base_url}: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'url': base_url,
            'status': 'error'
        }), 500, cors_headers

# Opdater main blokken
if __name__ == "__main__":
    uvicorn.run(asgi_app, host="0.0.0.0", port=int(os.environ.get('PORT', 8080)))
