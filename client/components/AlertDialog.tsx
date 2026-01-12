import React from 'react';

interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'info' | 'success' | 'warning';
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'OK',
  onConfirm,
  variant = 'info'
}) => {
  if (!isOpen) return null;

  const getButtonColors = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'success':
        return 'bg-green-600 hover:bg-green-700 text-white';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white';
      default:
        return 'bg-primary hover:bg-primary-dark text-white';
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'danger':
        return 'text-red-600';
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-amber-600';
      default:
        return 'text-blue-600';
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return 'error';
      case 'success':
        return 'check_circle';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[480px] max-w-[90vw] overflow-hidden animate-scale-in">
        {/* Header with Icon */}
        <div className="p-6 pb-4">
          <div className="flex items-start space-x-4">
            <div className={`flex-shrink-0 ${getIconColor()}`}>
              <span className="material-icons text-4xl">{getIcon()}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end">
          <button
            onClick={onConfirm}
            className={`px-6 py-2.5 font-semibold rounded-lg transition-colors shadow-md ${getButtonColors()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

