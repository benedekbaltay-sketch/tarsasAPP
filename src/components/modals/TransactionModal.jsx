import React from 'react';
import { UniversalTransactionModal } from './UniversalTransactionModal';

export function TransactionModal({ isOpen, onClose, initialData = null }) {
  return (
    <UniversalTransactionModal
      isOpen={isOpen}
      onClose={onClose}
      initialData={initialData}
    />
  );
}
