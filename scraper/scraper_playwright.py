import asyncio
import requests
from bs4 import BeautifulSoup, NavigableString, Comment
import os
import re
import unicodedata
import logging
from urllib.parse import urlparse, urljoin
from playwright.async_api import async_playwright

class WebScraper:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')

        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/116.0.0.0 Safari/537.36"
            )
        }

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

        # Opret hovedmappe til outputfiler
        self.output_dir = "webscraping"
        os.makedirs(self.output_dir, exist_ok=True)

        # Opret separate mapper for interne og eksterne links
        self.internal_output_dir = os.path.join(self.output_dir, "interne")
        self.external_output_dir = os.path.join(self.output_dir, "eksterne")
        os.makedirs(self.internal_output_dir, exist_ok=True)
        os.makedirs(self.external_output_dir, exist_ok=True)

        # Opret en `requests.Session` for vedvarende forbindelser
        self.session = requests.Session()
        self.session.headers.update(self.headers)

        # Implementer Retry og HTTPAdapter for fejlhåndtering og genforsøg
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry

        retries = Retry(
            total=5,  # Antal forsøg
            backoff_factor=1,  # Tid mellem forsøg (eksponentiel backoff)
            status_forcelist=[502, 503, 504],  # Statuskoder, der skal trigge et genforsøg
            allowed_methods=["HEAD", "GET", "OPTIONS"]  # Metoder, der skal genprøves
        )
        adapter = HTTPAdapter(max_retries=retries)
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)

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
                logging.debug(f"Fjerner gentaget afsnit: {para[:30]}...")

        return '\n\n'.join(unique_paragraphs)


    async def scrape_page(self, url, filename, category):
        """
        Scraper en enkelt side og gemmer indholdet i den angivne kategori-mappe.
        """
        try:
            logging.info(f"Starter scraping af: {url} (Kategori: {category})")
            html = await self.get_page_source_with_playwright(url)

            if not html:
                return

            # Ekstrakter Calendly URLs før parsing med BeautifulSoup
            calendly_urls = self.extract_calendly_urls(html)
            logging.debug(f"Fundet {len(calendly_urls)} Calendly URL(s) i {url}")

            # Parse HTML
            soup = BeautifulSoup(html, "html.parser")
            soup = self.remove_html_comments_from_soup(soup)
            logging.info(f"Parsed HTML for: {url}")

            # Fjern uønskede elementer baseret på specifikke CSS-selektorer
            for selector in self.unwanted_selectors:
                for element in soup.select(selector):
                    element.decompose()

            # Fjern <script> og <style> tags for at undgå JavaScript i outputtet
            for script_or_style in soup(['script', 'style']):
                script_or_style.decompose()

            # Find alle produktsektioner
            # Opdater denne selector til at matche dine produktcontainere
            product_sections = soup.find_all('div', class_='product-item')  # Tilpas 'product-item' til dit website

            formatted_text = f"URL: {url}\n\n"

            if product_sections:
                for idx, product in enumerate(product_sections, 1):
                    product_info = self.extract_product_info(product, url)
                    if product_info:
                        formatted_text += f"### Produkt {idx}\n\n"
                        formatted_text += product_info
                        formatted_text += "\n---\n\n"
            else:
                # Hvis ingen produkter findes, brug den eksisterende process_element funktion
                body = soup.find('body')
                if body:
                    self.seen_paragraphs = set()
                    formatted_text += self.process_element(body, url=url)

            logging.debug(f"Formatted text for {url}:\n{formatted_text[:500]}")  # Log de første 500 tegn

            # Fjern gentagne afsnit
            formatted_text = self.remove_duplicate_paragraphs(formatted_text)

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

            # Rens og normaliser teksten
            formatted_text = self.clean_and_normalize(formatted_text)
            formatted_text = self.remove_image_lines(formatted_text)

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
                logging.error(f"Fejl ved skrivning til fil: {filepath} ({e})")
                return

            # Rens for konsekutive gentagelser på sætningeniveau
            self.remove_consecutive_repeated_sentences(filepath)
            logging.info(f"Rensede gentagne sætninger i '{filepath}'")
        except Exception as e:
                logging.error(f"Fejl ved skrivning til fil: {filepath} ({e})")
                return   

    async def get_page_source_with_playwright(self, url):
        """
        Henter sidekilden ved hjælp af Playwright.
        """
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent=self.headers["User-Agent"]
                )
                page = await context.new_page()
                await page.goto(url)
                await page.wait_for_load_state('networkidle')
                html = await page.content()
                logging.info(f"Hentede indhold for: {url}")
                await context.close()
                await browser.close()
                return html
        except Exception as e:
            logging.error(f"Fejl ved hentning af siden med Playwright: {url} ({e})")
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
            logging.error(f"Fejl ved udtrækning af produktinformation: {e}")
            return ''

    def process_element(self, element, parent_bold=False, url=None):
        text = ''
        is_current_bold = parent_bold

        try:
            if isinstance(element, NavigableString):
                cleaned_text = self.clean_and_normalize(element.strip())
                return cleaned_text

            # Log element information
            logging.debug(f"Behandler element: <{element.name}> med attributter {element.attrs}")

            # Check for elements with 'heading' and 'heading--small' classes
            if 'heading' in element.get('class', []) and 'heading--small' in element.get('class', []):
                heading_text = element.get_text(strip=True)
                if self.is_redundant_heading(heading_text, element):
                    logging.debug(f"Removing redundant heading: {heading_text}")
                    return ''  # Skip this heading
                else:
                    # Optionally format non-redundant headings
                    text += f"{heading_text}\n\n"

            # Specifik behandling af 'a' tags uanset forælder
            if element.name == 'a':
                link_text = element.get_text(strip=True)
                link_href = element.get('href', '').strip()
                logging.debug(f"Found <a> tag with text: '{link_text}' and href: '{link_href}'")

                # Ekstrakter URLs fra onclick attributten hvis href er tom eller ugyldig
                if not link_href:
                    onclick_attr = element.get('onclick', '')
                    extracted_urls = self.find_urls_in_text(onclick_attr)
                    if extracted_urls:
                        link_href = extracted_urls[0]  # Antager første URL i onclick er relevant
                        logging.debug(f"Ekstrakteret URL fra onclick: {link_href}")
                if link_href and not link_href.startswith(("http://", "https://")):
                    link_href = urljoin(url, link_href)
                    logging.debug(f"Sanitized href: {link_href}")
                if link_text and link_href:
                    formatted_link = f"[{link_text}]({link_href})"
                    logging.debug(f"Formatted link: {formatted_link}")
                    return formatted_link
                else:
                    return ''  # Returner tom streng for tomme links

            # Identify heading tags and text-h classes
            if element.name in ["h1", "h2", "h3", "h4", "h5", "h6", "heading", "title"]:
                level = int(element.name[1]) if element.name.startswith('h') else 1
                heading_text = element.get_text(strip=True)
                if heading_text:
                    if self.is_redundant_heading(heading_text, element):
                        logging.debug(f"Removing redundant heading: {heading_text}")
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
                        logging.debug(f"Fjerner gentaget afsnit i process_element: {para_clean[:30]}...")
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
        Determines if a heading is redundant based on its text and classes.
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
            logging.error(f"Fejl ved rensning af fil: {filepath} ({e})")

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
            logging.debug(f"Udelukker link pga. sti: {link}")
            return False

        # Tjek for uønskede filendelser
        if any(link.lower().endswith(ext) for ext in self.excluded_extensions):
            logging.debug(f"Udelukker link pga. filendelse: {link}")
            return False

        # Tillad kun links uden filendelse eller med .html/.htm
        if not re.search(r'\.\w+$', link) or link.lower().endswith(('.html', '.htm')):
            return True

        logging.debug(f"Udelukker link: {link}")
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
            logging.error(f"Fejl i run metoden: {e}")

def main():
    # Spørg brugeren om URL'en, der skal scrapes
    user_input = input("Indtast den URL, der skal scrapes: ").strip()

    # Normaliser URL'en
    if not re.match(r'^https?://', user_input):
        user_input = 'https://' + user_input
        print(f"Tilføjet 'https://' til URL'en.")

    # Tilføj www. hvis det mangler
    parsed_url = urlparse(user_input)
    if not parsed_url.netloc.startswith('www.'):
        netloc = 'www.' + parsed_url.netloc
        user_input = parsed_url._replace(netloc=netloc).geturl()
        print(f"Tilføjet 'www.' til URL'en.")

    print(f"Endelig URL: {user_input}")

    scraper = WebScraper(user_input)
    asyncio.run(scraper.run())

if __name__ == "__main__":
    main()