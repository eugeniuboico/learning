import React from 'react';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[400px] p-6 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="material-icons text-red-500 text-4xl">delete_outline</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-6">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex space-x-3">
          <button
            className="flex-1 px-4 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="flex-1 px-4 py-2.5 rounded-lg text-white bg-red-500 hover:bg-red-600 font-semibold transition-colors"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
