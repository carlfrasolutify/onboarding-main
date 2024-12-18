// CompanyInformationStep.js

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";

const CompanyInformationStep = ({
  onNext,
  onPrev,
  updateFormData,
  initialData,
}) => {
  const [currentField, setCurrentField] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    clearErrors,
    getValues,
    watch,
  } = useForm({
    defaultValues: initialData,
    mode: "onChange",
  });

  const fields = [
    {
      name: "companyName",
      label: "Virksomhedens navn?",
      type: "text",
      placeholder: "Indtast virksomhedens navn",
      validation: { required: "Virksomhedsnavn er påkrævet" },
    },
    {
      isMultiField: true,
      label: "Hvad er virksomhedens kontaktoplysninger?",
      fields: [
        {
          name: "contactEmail",
          type: "email",
          placeholder: "Indtast kontakt-e-mail",
          validation: {
            required: "Kontakt-e-mail er påkrævet",
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: "Ugyldig e-mailadresse",
            },
          },
        },
        {
          name: "contactPhone",
          type: "tel",
          placeholder: "F.eks. 12345678 eller +45 12345678",
          validation: {
            required: "Telefonnummer er påkrævet",
            pattern: {
              value: /^(?:(?:\+|00)?(?:45|46|47)[ -]?)?[0-9]{8,10}$/,
              message: "Indtast venligst et gyldigt telefonnummer",
            },
          },
        },
      ],
    },
    {
      isMultiField: true,
      label: "Hvad er virksomhedens adresse?",
      fields: [
        {
          name: "address",
          type: "text",
          placeholder: "Indtast virksomhedens adresse",
          validation: { required: "Adresse er påkrævet" },
        },
        {
          name: "postalCode",
          type: "text",
          placeholder: "Indtast postnummer",
          validation: {
            required: "Postnummer er påkrævet",
            pattern: {
              value: /^[0-9]{1,10}$/,
              message: "Indtast venligst kun cifre",
            },
          },
        },
        {
          name: "city",
          type: "text",
          placeholder: "Indtast by",
          validation: { required: "By er påkrævet" },
        },
      ],
    },
    {
      name: "companySize",
      label: "Hvilken størrelse virksomhed har du?",
      type: "select",
      options: [
        { value: "", label: "Vælg virksomhedsstørrelse" },
        { value: "startup", label: "Startup (0-10 ansatte)" },
        { value: "small", label: "Lille virksomhed (11-50 ansatte)" },
        { value: "medium", label: "Mellemstor virksomhed (51-200 ansatte)" },
        { value: "large", label: "Stor virksomhed (201-500 ansatte)" },
        { value: "enterprise", label: "Enterprise (500+ ansatte)" },
      ],
      validation: { required: "Virksomhedsstørrelse er påkrævet" },
    },
    {
      name: "industry",
      label: "Hvilken industri er din virksomhed i?",
      type: "select",
      options: [
        { value: "", label: "Vælg industri" },
        { value: "webshop", label: "Webshop" },
        { value: "consulting", label: "Rådgivning" },
        { value: "accounting", label: "Revisor" },
        { value: "insurance", label: "Forsikring" },
        { value: "it", label: "IT" },
        { value: "healthcare", label: "Sundhed" },
        { value: "education", label: "Uddannelse" },
        { value: "construction", label: "Byggeri" },
        { value: "manufacturing", label: "Produktion" },
        { value: "other", label: "Andet" },
      ],
      validation: { required: "Industri er påkrævet" },
    },
    {
      name: "companyDescription",
      label: "Hvad er virksomhedens kerneydelse?",
      type: "textarea",
      placeholder:
        "Beskriv gerne virksomheden, jeres services, produkter og andre relevante detaljer...",
      validation: {
        maxLength: {
          value: 500,
          message: "Beskrivelsen må maksimalt være 500 tegn",
        },
      },
    },
  ];

  // Update formData whenever form values change
  useEffect(() => {
    const subscription = watch((value) => {
      updateFormData(value);
    });
    return () => subscription.unsubscribe();
  }, [watch, updateFormData]);

  const handleNextStep = async () => {
    const current = fields[currentField];
    if (current.isMultiField) {
      const fieldsToValidate = current.fields.map((f) => f.name);
      const isValid = await trigger(fieldsToValidate);
      if (isValid) {
        clearErrors();
        if (currentField < fields.length - 1) {
          setCurrentField((prev) => prev + 1);
        } else {
          handleSubmit(onSubmit)();
        }
      }
    } else {
      const isValid = await trigger(current.name);
      if (isValid) {
        clearErrors();
        if (currentField < fields.length - 1) {
          setCurrentField((prev) => prev + 1);
        } else {
          handleSubmit(onSubmit)();
        }
      }
    }
  };

  const handleKeyPress = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleNextStep();
    }
  };

  const onSubmit = (data) => {
    // Formatér telefonnummeret
    if (data.contactPhone && !data.contactPhone.startsWith("+")) {
      const cleanedNumber = data.contactPhone.replace(/[- ]/g, "");
      if (cleanedNumber.length === 8) {
        data.contactPhone = "+45" + cleanedNumber;
      }
    }
    updateFormData(data);
    onNext();
  };

  return (
    <div className="h-full flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-lg mx-auto"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentField}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              {fields[currentField].label}
            </h2>

            <div className="space-y-4">
              {fields[currentField].isMultiField ? (
                fields[currentField].fields.map((subField, index) => (
                  <div key={subField.name}>
                    <input
                      type={subField.type}
                      {...register(subField.name, subField.validation)}
                      className="w-full p-3 text-lg border-b-2 border-gray-300 focus:border-blue-500 outline-none text-gray-900 bg-transparent placeholder:text-gray-500 placeholder:opacity-70"
                      placeholder={subField.placeholder}
                      autoFocus={index === 0}
                      onKeyPress={handleKeyPress}
                    />
                    {errors[subField.name] && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-red-500 text-sm mt-1"
                      >
                        {errors[subField.name].message}
                      </motion.p>
                    )}
                  </div>
                ))
              ) : fields[currentField].type === "select" ? (
                <div>
                  <select
                    {...register(
                      fields[currentField].name,
                      fields[currentField].validation
                    )}
                    className="w-full p-3 text-lg border-b-2 border-gray-300 focus:border-blue-500 outline-none text-gray-900 bg-transparent"
                    onKeyPress={handleKeyPress}
                  >
                    {fields[currentField].options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors[fields[currentField].name] && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-500 text-sm mt-1"
                    >
                      {errors[fields[currentField].name].message}
                    </motion.p>
                  )}
                </div>
              ) : fields[currentField].type === "textarea" ? (
                <div>
                  <textarea
                    {...register(
                      fields[currentField].name,
                      fields[currentField].validation
                    )}
                    className="w-full p-3 text-lg border-2 border-gray-300 focus:border-blue-500 outline-none text-gray-900 bg-transparent rounded-lg resize-none placeholder:text-gray-500 placeholder:opacity-70"
                    placeholder={fields[currentField].placeholder}
                    rows={4}
                    autoFocus
                    onKeyPress={handleKeyPress}
                  />
                  {errors[fields[currentField].name] && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-500 text-sm mt-1"
                    >
                      {errors[fields[currentField].name].message}
                    </motion.p>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type={fields[currentField].type}
                    {...register(
                      fields[currentField].name,
                      fields[currentField].validation
                    )}
                    className="w-full p-3 text-lg border-b-2 border-gray-300 focus:border-blue-500 outline-none text-gray-900 bg-transparent placeholder:text-gray-500 placeholder:opacity-70"
                    placeholder={fields[currentField].placeholder}
                    autoFocus
                    onKeyPress={handleKeyPress}
                  />
                  {errors[fields[currentField].name] && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-500 text-sm mt-1"
                    >
                      {errors[fields[currentField].name].message}
                    </motion.p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-8">
              <button
                type="button"
                onClick={() => {
                  if (currentField > 0) {
                    setCurrentField((prev) => prev - 1);
                  } else {
                    onPrev();
                  }
                }}
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Tilbage
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition font-medium"
              >
                {currentField === fields.length - 1 ? "Næste" : "Næste"}
              </button>
            </div>

            <div className="flex justify-center mt-8">
              <div className="flex gap-2">
                {fields.map((_, index) => (
                  <motion.div
                    key={index}
                    className={`h-1 w-8 rounded-full ${
                      index === currentField ? "bg-blue-500" : "bg-gray-200"
                    }`}
                    animate={{
                      backgroundColor:
                        index === currentField ? "#3B82F6" : "#E5E7EB",
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </form>
    </div>
  );
};

export default CompanyInformationStep;