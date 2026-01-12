import { useState } from 'react';

export type DialogVariant = 'danger' | 'info' | 'success' | 'warning';

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: DialogVariant;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  variant: DialogVariant;
  onConfirmCallback: () => void;
}

export const useDialog = () => {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  });

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
    onConfirmCallback: () => {}
  });

  const showAlert = (title: string, message: string, variant: DialogVariant = 'info') => {
    setAlertState({ isOpen: true, title, message, variant });
  };

  const hideAlert = () => {
    setAlertState({ ...alertState, isOpen: false });
  };

  const showConfirm = (
    title: string, 
    message: string, 
    onConfirm: () => void,
    variant: DialogVariant = 'info'
  ) => {
    setConfirmState({ 
      isOpen: true, 
      title, 
      message, 
      variant,
      onConfirmCallback: onConfirm 
    });
  };

  const hideConfirm = () => {
    setConfirmState({ ...confirmState, isOpen: false });
  };

  const handleConfirm = () => {
    confirmState.onConfirmCallback();
    hideConfirm();
  };

  return {
    alertState,
    confirmState,
    showAlert,
    hideAlert,
    showConfirm,
    hideConfirm,
    handleConfirm
  };
};

