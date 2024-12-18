// UserInformationStep.js

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";

const UserInformationStep = ({
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
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const fields = [
    {
      isMultiField: true,
      label: "Hvad er dit navn?",
      fields: [
        {
          name: "firstname",
          type: "text",
          placeholder: "Indtast dit fornavn",
          validation: { required: "Fornavn er påkrævet" },
        },
        {
          name: "lastname",
          type: "text",
          placeholder: "Indtast dit efternavn",
          validation: { required: "Efternavn er påkrævet" },
        },
      ],
    },
    {
      name: "phoneNumber",
      label: "Hvad er dit telefonnummer?",
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
  ];

  // Update formData whenever form values change
  useEffect(() => {
    const subscription = watch((value) => {
      updateFormData(value);
    });
    return () => subscription.unsubscribe();
  }, [watch, updateFormData]);

  const handleNextStep = async () => {
    clearErrors();
    const field = fields[currentField];
    let valid = true;

    if (field.isMultiField) {
      for (const subField of field.fields) {
        const result = await trigger(subField.name);
        if (!result) {
          valid = false;
        }
      }
    } else {
      valid = await trigger(field.name);
    }
    
    if (valid) {
      const currentValues = getValues();
      updateFormData(currentValues);

      if (currentField < fields.length - 1) {
        setCurrentField(currentField + 1);
      } else {
        handleSubmit(onSubmit)(); // Calls onSubmit when all fields are completed
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
    // Format the phone number
    if (data.phoneNumber && !data.phoneNumber.startsWith("+")) {
      const cleanedNumber = data.phoneNumber.replace(/[- ]/g, "");
      if (cleanedNumber.length === 8) {
        data.phoneNumber = "+45" + cleanedNumber;
      }
    }
    updateFormData(data); // Updates formData with entered data
    onNext();
  };

  return (
    <div className="h-full flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-lg mx-auto"
      >
        <AnimatePresence mode="wait">
          {currentField < fields.length && (
            <motion.div
              key={currentField}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  {fields[currentField].label}
                </h2>
              </div>

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

              {/* Navigation buttons */}
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

              {/* Progress indicator */}
              <div className="flex justify-center mt-6">
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
          )}
        </AnimatePresence>
      </form>
    </div>
  );
};

export default UserInformationStep;