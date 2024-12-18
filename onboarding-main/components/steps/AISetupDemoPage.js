// AISetupDemoPage.js

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { HexColorPicker } from "react-colorful";
import {
  Send,
  Bot,
  Settings2,
  X,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Star,
  Plus,
  Trash2,
} from "lucide-react";

const AISetupDemoPage = ({ onNext, onPrev, updateFormData, initialData }) => {
  const [messages, setMessages] = useState(() => {
    return (
      initialData.messages || [
        {
          type: "bot",
          content:
            initialData.welcomeMessage ||
            "Hej! Velkommen til Solutify. Vi er eksperter i AI Assistenter og AI-løsninger. Hvordan kan vi hjælpe dig i dag?",
          suggestedMessages:
            (initialData.conversationStarters || [
              "Hvordan kan I hjælpe min virksomhed?",
              "Fortæl mere om jeres services",
            ]).filter((starter) => starter.trim() !== ""),
        },
      ]
    );
  });
  const [inputMessage, setInputMessage] = useState("");
  const [uploadedLogo, setUploadedLogo] = useState(initialData.uploadedLogo || null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(
    initialData.uploadedLogo && initialData.uploadedLogo.content
      ? initialData.uploadedLogo.content
      : null
  );
  const [currentStep, setCurrentStep] = useState(initialData.currentStep || 0);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [conversationStarters, setConversationStarters] = useState(
    initialData.conversationStarters || [
      "Hvordan kan I hjælpe min virksomhed?",
      "Fortæl mere om jeres services",
    ]
  );
  const [showStartersModal, setShowStartersModal] = useState(false);
  const [logoError, setLogoError] = useState("");

  const messagesEndRef = useRef(null);
  const logoInputRef = useRef(null);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      companyName: initialData.companyName || "Solutify",
      welcomeMessage:
        initialData.welcomeMessage ||
        "Hej! Velkommen til Solutify. Vi er eksperter i AI Assistenter og AI-løsninger. Hvordan kan vi hjælpe dig i dag?",
      headerColor: initialData.headerColor || "#4F46E5",
      textColor: initialData.textColor || "#FFFFFF",
    },
  });

  const watchedValues = watch();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'welcomeMessage') {
        setMessages(prev => [{
          ...prev[0],
          content: value.welcomeMessage,
          suggestedMessages: conversationStarters.filter(starter => starter.trim() !== '')
        }]);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [watch, conversationStarters]);

  useEffect(() => {
    if (uploadedLogo) {
      if (uploadedLogo.preview) {
        setLogoPreviewUrl(uploadedLogo.preview);
      } else if (uploadedLogo.content) { // Backward compatibility
        setLogoPreviewUrl(uploadedLogo.content);
      }
    }
  }, [uploadedLogo]);

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Create FileReader for preview
      const reader = new FileReader();
      reader.onload = function(e) {
        const logoData = {
          file: file,              // Original file for upload
          preview: e.target.result, // Data URL for preview
          metadata: {              // Metadata for reconstituting file
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
          }
        };
        
        setUploadedLogo(logoData);
        setLogoPreviewUrl(e.target.result);
        updateFormData({ uploadedLogo: logoData });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoDelete = () => {
    setUploadedLogo(null);
    setLogoPreviewUrl(null);
    
    // Update formData here
    updateFormData({ uploadedLogo: null, logoPreviewUrl: null });
  };

  const handleStepChange = async (nextStep) => {
    if (nextStep > currentStep) {
      const isValid = await trigger(
        currentStep === 0
          ? ["companyName", "headerColor"]
          : ["welcomeMessage"]
      );

      if (currentStep === 0 && !uploadedLogo) {
        setLogoError("Logo er påkrævet");
        return;
      } else {
        setLogoError("");
      }

      if (!isValid) return;
    }
    setCurrentStep(nextStep);
    
    // Update formData here with the new currentStep
    updateFormData({ currentStep: nextStep });
  };

  const handleSendMessage = (content) => {
    if (!content.trim()) return;

    const newMessages = [...messages, { type: "user", content }];
    setMessages(newMessages);

    // Update formData here
    updateFormData({ messages: newMessages });

    setInputMessage("");

    // Simulate bot response
    setTimeout(() => {
      const response = `Tak for din besked! Dette er et demo-svar på: "${content}". I den fulde version vil dette være forbundet til vores AI-backend.`;
      const updatedMessages = [...newMessages, { type: "bot", content: response }];
      setMessages(updatedMessages);
      
      // Update formData here
      updateFormData({ messages: updatedMessages });
    }, 1000);
  };

  const handleSuggestedMessage = (message) => {
    handleSendMessage(message);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  const resetConversation = () => {
    const defaultMessages = [
      {
        type: "bot",
        content: watchedValues.welcomeMessage,
        suggestedMessages: conversationStarters.filter(
          (starter) => starter.trim() !== ""
        ),
      },
    ];
    setMessages(defaultMessages);
    
    // Update formData here
    updateFormData({ messages: defaultMessages });
    
    setInputMessage("");
  };

  const handleAddConversationStarter = () => {
    setConversationStarters([...conversationStarters, ""]);
  };

  const handleStarterChange = (index, value) => {
    const newStarters = [...conversationStarters];
    newStarters[index] = value;
    setConversationStarters(newStarters);
    
    // Update formData here
    updateFormData({ conversationStarters: newStarters });
  };

  const handleRemoveStarter = (index) => {
    const updatedStarters = conversationStarters.filter((_, i) => i !== index);
    setConversationStarters(updatedStarters);
    
    // Update formData here
    updateFormData({ conversationStarters: updatedStarters });
  };

  const handleOpenStartersModal = () => {
    setShowStartersModal(true);
  };

  const handleSaveStarters = () => {
    const filteredStarters = localStarters.filter((starter) => starter.trim() !== "");
    setConversationStarters(filteredStarters);
    updateFormData({ conversationStarters: filteredStarters });
    setShowStartersModal(false);
  };

  const onSubmit = (data) => {
    // Gem form data før vi går videre
    const finalData = {
      ...data,
      welcomeMessage: data.welcomeMessage,
      conversationStarters: conversationStarters.filter(starter => starter.trim() !== "")
    };
    
    // Fjern messages fra formData da vi ikke skal bruge chat-historikken
    delete finalData.messages;
    
    updateFormData(finalData);
    onNext();
  };

  const renderCustomizationStep = () => {
    if (currentStep === 0) {
      return (
        <motion.div
          key="design-step"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Grundlæggende indstillinger
          </h3>
          {/* Logo Upload */}
          <div>
            <label className="block mb-2 text-gray-900 font-medium">
              Upload logo
            </label>
            <input
              type="file"
              ref={logoInputRef}
              onChange={handleLogoUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="w-full h-[52px] bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg overflow-hidden"
            >
              <div className="flex items-center justify-center h-full px-6">
                {logoPreviewUrl ? (
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <img
                        src={logoPreviewUrl}
                        alt="Logo"
                        className="h-5 w-5 object-contain"
                      />
                    </div>
                    <span className="flex-shrink-0">Skift logo</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLogoDelete();
                      }}
                      className="w-8 h-8 flex items-center justify-center hover:bg-blue-600 rounded-full transition-all duration-200 flex-shrink-0 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <Bot className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-shrink-0">Upload logo</span>
                  </div>
                )}
              </div>
            </button>
            {logoError && (
              <p className="text-red-500 text-sm mt-1">{logoError}</p>
            )}
          </div>
          {/* Company Name */}
          <div>
            <label className="block mb-2 text-gray-900 font-medium">
              Virksomhedsnavn
            </label>
            <input
              type="text"
              {...register("companyName", {
                required: "Virksomhedsnavn er påkrævet",
              })}
              className="w-full p-3 border rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            {errors.companyName && (
              <p className="text-red-500 text-sm mt-1">
                {errors.companyName.message}
              </p>
            )}
          </div>
          {/* Header Color */}
          <div>
            <label className="block mb-2 text-gray-900 font-medium">
              Header farve
            </label>
              <div className="relative">
                <div className="flex gap-3 items-center">
                  {/* Color Preview */}
                  <div 
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="w-12 h-12 rounded-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
                    style={{ backgroundColor: watchedValues.headerColor }}
                  />
                  <input 
                    type="text"
                    value={watchedValues.headerColor}
                    onChange={(e) => setValue("headerColor", e.target.value)}
                    className="flex-1 p-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="#000000"
                  />
                </div>
                
                {/* Color Picker Popup */}
                {showColorPicker && (
                  <div 
                    className="absolute left-0 bottom-full mb-1 rounded-lg shadow-xl p-0 z-10"
                    style={{ width: '240px', height: '240px' }}
                    onBlur={() => setShowColorPicker(false)}
                  >
                    <HexColorPicker 
                      color={watchedValues.headerColor} 
                      onChange={(color) => {
                        setValue("headerColor", color);
                        updateFormData({ headerColor: color });
                      }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                )}
              </div>
          </div>
          {/* Text Color */}
          <div>
            <label className="block mb-2 text-gray-900 font-medium">
              Tekst farve
            </label>
            <div className="relative">
              <div className="flex gap-3 items-center">
                {/* Color Preview */}
                <div 
                  onClick={() => setShowTextColorPicker(!showTextColorPicker)}
                  className="w-12 h-12 rounded-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: watchedValues.textColor }}
                />
                <input 
                  type="text"
                  value={watchedValues.textColor}
                  onChange={(e) => setValue("textColor", e.target.value)}
                  className="flex-1 p-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="#FFFFFF"
                />
              </div>
              
              {/* Color Picker Popup */}
              {showTextColorPicker && (
                <div 
                  className="absolute left-0 bottom-full mb-1 rounded-lg shadow-xl p-0 z-10"
                  style={{ width: '240px', height: '240px' }}
                  onBlur={() => setShowTextColorPicker(false)}
                >
                  <HexColorPicker 
                    color={watchedValues.textColor} 
                    onChange={(color) => {
                      setValue("textColor", color);
                      updateFormData({ textColor: color });
                    }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              )}
            </div>
          </div>      

        </motion.div>
      );
    }

    return (
      <motion.div
        key="message-step"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="space-y-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Besked indstillinger
        </h3>
        {/* Welcome Message */}
        <div>
          <label className="block mb-2 text-gray-900 font-medium">
            Velkomstbesked
          </label>
          <textarea
            {...register("welcomeMessage", {
              required: "Velkomstbesked er påkrævet",
            })}
            rows={4}
            className="w-full p-3 border rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          {errors.welcomeMessage && (
            <p className="text-red-500 text-sm mt-1">
              {errors.welcomeMessage.message}
            </p>
          )}
        </div>
        {/* Conversation Starters */}
        <div className="space-y-3 mt-6">
          <label className="block text-gray-900 font-medium">
            Samtale startere
          </label>
          <button
            type="button"
            onClick={handleOpenStartersModal}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-600 font-medium mt-4"
          >
            <Settings2 className="w-5 h-5" />
            Administrer startere ({conversationStarters.length})
          </button>
        </div>
      </motion.div>
    );
  };

  const ReviewModal = ({ onClose }) => {
    const [feedback, setFeedback] = useState("");

    return (
      <div className="absolute inset-4 bg-white rounded-xl shadow-2xl z-50 overflow-hidden">
        <div className="relative h-full flex flex-col">
          {/* Header */}
          <div 
            style={{ backgroundColor: watchedValues.headerColor }} 
            className="p-4 text-white text-center relative"
          >
            <button 
              onClick={onClose}
              className="absolute right-4 top-4 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-semibold">Hvordan var din oplevelse?</h3>
            <p className="text-white/80 text-sm mt-1">Din feedback hjælper os med at forbedre vores service</p>
          </div>

          {/* Rating */}
          <div className="flex-1 p-6 flex flex-col items-center justify-center">
            <div className="flex items-center justify-center space-x-1 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="relative p-2 transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-12 h-12 transition-colors ${
                      (hoverRating || rating) >= star
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                  <div
                    className={`absolute inset-0 bg-yellow-400/20 rounded-full -z-10 transition-opacity duration-200 ${
                      (hoverRating || rating) >= star ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Feedback form */}
            <div className={`w-full max-w-md space-y-4 transition-opacity duration-200 ${rating ? 'opacity-100' : 'opacity-0'}`}>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Fortæl os om din oplevelse (valgfrit)"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-32 text-gray-900 bg-gray-100"
              />
              <button
                onClick={() => {
                  onClose();
                  setMessages(prev => [...prev, {
                    type: "bot",
                    content: "Tak for din feedback! Det betyder meget for os at høre din mening."
                  }]);
                }}
                className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-all hover:shadow-lg active:scale-[0.98]"
              >
                Send feedback
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const StartersModal = () => {
    const [localStarters, setLocalStarters] = useState([...conversationStarters]);

    const handleAddStarter = () => {
      setLocalStarters(prev => [...prev, '']);
    };

    const handleRemoveStarter = (index) => {
      setLocalStarters(prev => prev.filter((_, i) => i !== index));
    };

    const handleInputChange = (index, value) => {
      setLocalStarters(prev => {
        const newStarters = [...prev];
        newStarters[index] = value;
        return newStarters;
      });
    };

    // Opdater handleSave i StartersModal
    const handleSave = () => {
      const filteredStarters = localStarters.filter((starter) => starter.trim() !== "");
      setConversationStarters(filteredStarters);
      updateFormData({ conversationStarters: filteredStarters });
      
      // Opdater den første besked med de nye samtale startere
      setMessages(prev => [{
        ...prev[0],
        suggestedMessages: filteredStarters
      }]);
      
      setShowStartersModal(false);
    };

    const handleCancel = () => {
      setShowStartersModal(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        >
          {/* Modal header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Administrer samtale startere
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-500 hover:text-gray-700 rounded-lg p-1 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal content */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {localStarters.map((starter, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={starter}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      placeholder="Skriv en samtale starter..."
                      className="flex-1 p-3 border rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                    <motion.button
                      type="button"
                      onClick={() => handleRemoveStarter(index)}
                      className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <motion.button
              type="button"
              onClick={handleAddStarter}
              className="flex items-center gap-2 text-blue-500 hover:text-blue-600 font-medium mt-4"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-5 h-5" />
              Tilføj starter
            </motion.button>
          </div>

          {/* Modal footer */}
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
            <motion.button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 rounded-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Annuller
            </motion.button>
            <motion.button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Gem ændringer
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Left side - Customization Form */}
      <div className="w-1/2 p-6 overflow-y-auto">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-gray-900">
            Tilpas din AI Assistent
          </h2>
          {/* Progress Indicator */}
          <div className="mb-8 flex items-center justify-center space-x-4">
            {[0, 1].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => handleStepChange(step)}
                className={`flex items-center ${
                  currentStep === step ? "text-blue-500" : "text-gray-500"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-medium
                  ${
                    currentStep === step
                      ? "border-blue-500 text-blue-500"
                      : "border-gray-500"
                  }`}
                >
                  {step + 1}
                </div>
                <span className="ml-2 text-sm font-medium">
                  {step === 0 ? "Design" : "Beskeder"}
                </span>
              </button>
            ))}
          </div>

          {/* Split form submission based on current step */}
          {currentStep === 1 ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <AnimatePresence mode="wait">
                {renderCustomizationStep()}
              </AnimatePresence>
              <div className="flex justify-between pt-4 border-t mt-8">
                <button
                  type="button"
                  onClick={() => handleStepChange(0)}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition font-medium flex items-center"
                >
                  Tilbage
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center"
                >
                  Næste
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {renderCustomizationStep()}
              </AnimatePresence>
              <div className="flex justify-between pt-4 border-t mt-8">
                <button
                  type="button"
                  onClick={onPrev}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition font-medium"
                >
                  Tilbage
                </button>
                <button
                  type="button"
                  onClick={() => handleStepChange(1)}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Næste
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Preview */}
      <div className="w-1/2 p-6">
        <div className="max-w-md mx-auto">
          <div className="rounded-lg overflow-hidden h-[600px] flex flex-col relative">
            {/* Chat Header */}
            <div
              style={{
                backgroundColor: watchedValues.headerColor,
                color: watchedValues.textColor,
              }}
              className="p-4 rounded-t-lg"
            >
              <div className="flex items-center justify-between">
                {/* Left side */}
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-white rounded-full flex-shrink-0">
                    {logoPreviewUrl ? (
                      <img
                        src={logoPreviewUrl}
                        alt="Logo"
                        className="w-6 h-6 object-contain"
                      />
                    ) : (
                      <Bot className="w-6 h-6 text-blue-500" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span style={{ color: watchedValues.textColor }} className="font-medium text-lg">
                      {watchedValues.companyName}
                    </span>
                    <div className="flex items-center">
                      <div className="relative">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                        <div className="absolute inset-0 w-2 h-2 bg-green-400/30 rounded-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                      </div>
                      <span style={{ color: watchedValues.textColor, opacity: 0.8 }} className="text-sm ml-2">
                        Aktiv nu
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side - Controls */}
                <div className="flex items-center space-x-3">
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setShowReview(true)}
                    className="bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <span style={{ color: watchedValues.textColor }} className="text-sm font-medium">
                      Bedøm samtalen
                    </span>
                  </motion.button>
                  <div className="flex items-center space-x-2">
                    <RefreshCw 
                      onClick={resetConversation}
                      style={{ color: watchedValues.textColor }}
                      className="w-5 h-5 cursor-pointer hover:opacity-80 transition-opacity" 
                    />
                    <X 
                      style={{ color: watchedValues.textColor }}
                      className="w-5 h-5 cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${
                    message.type === "bot" ? "mb-1" : "mb-3"
                  }`}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`
                      ${
                        message.type === "bot"
                          ? "bg-gray-100 text-gray-900"
                          : "bg-blue-500 text-white"
                      } 
                      rounded-2xl px-4 py-2
                      ${message.type === "bot" ? "self-start" : "self-end"}
                      max-w-[85%]
                      text-[15px]
                    `}
                  >
                    {message.content}
                  </motion.div>
                  {message.type === "bot" &&
                    message.suggestedMessages?.length > 0 && (
                      <div className="mt-4 flex flex-col items-start gap-2">
                        <div className="flex flex-wrap gap-2">
                          {message.suggestedMessages.map(
                            (suggestedMsg, idx) => (
                              <button
                                key={idx}
                                onClick={() =>
                                  handleSuggestedMessage(suggestedMsg)
                                }
                                className="bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-900 text-sm transition-colors px-3 py-1.5"
                                style={{ whiteSpace: "nowrap" }}
                              >
                                {suggestedMsg}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            {/* Chat Input */}
            <div className="border-t bg-white">
              <div className="flex items-center space-x-2 bg-gray-50 m-4 rounded-lg px-4">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Stil et spørgsmål..."
                  className="flex-1 py-3 bg-transparent focus:outline-none text-gray-900"
                />
                <button
                  onClick={() => handleSendMessage(inputMessage)}
                  className="text-blue-500 hover:text-blue-600 transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showReview && (
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-40 rounded-lg">
                  <ReviewModal onClose={() => {
                    setShowReview(false);
                    setRating(0);
                    setHoverRating(0);
                  }} />
                </div>
              )}
            </AnimatePresence>

            {/* Starters Modal */}
            <AnimatePresence>
              {showStartersModal && (
                <StartersModal 
                  onClose={() => {
                    setShowStartersModal(false);
                    setTempStarters([...conversationStarters]);
                  }} 
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISetupDemoPage;