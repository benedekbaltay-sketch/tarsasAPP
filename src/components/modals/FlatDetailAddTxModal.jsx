import React from 'react';
import { UniversalTransactionModal } from './UniversalTransactionModal';

export function FlatDetailAddTxModal({ flatNum, isOpen, onClose }) {
  return (
    <UniversalTransactionModal
      isOpen={isOpen}
      onClose={onClose}
      initialData={{
        scope: flatNum === 'Global' ? 'global' : 'single',
        flatNum: flatNum === 'Global' ? undefined : flatNum
      }}
    />
  );
}
