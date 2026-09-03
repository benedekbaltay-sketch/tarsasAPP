import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { IosSideDrawer } from './components/IosSideDrawer';
import { LoginView } from './views/LoginView';
import { TenantView } from './views/TenantView';
import { AdminView } from './views/AdminView';

// Modals
import { FlatDetailModal } from './components/modals/FlatDetailModal';
import { TransactionModal } from './components/modals/TransactionModal';
import { FlatDetailAddTxModal } from './components/modals/FlatDetailAddTxModal';
import { EditTransactionModal } from './components/modals/EditTransactionModal';
import { GlobalBalancesModal } from './components/modals/GlobalBalancesModal';
import { AddFlatModal } from './components/modals/AddFlatModal';
import { EditFlatMasterModal } from './components/modals/EditFlatMasterModal';
import { FlatsDataModal } from './components/modals/FlatsDataModal';
import { FinancialSituationModal } from './components/modals/FinancialSituationModal';
import { DocumentsModal } from './components/modals/DocumentsModal';
import { LoansModal } from './components/modals/LoansModal';
import { ProfileModal } from './components/modals/ProfileModal';
import { BuildingSelectorModal } from './components/modals/BuildingSelectorModal';
import { AddBuildingModal } from './components/modals/AddBuildingModal';
import { FullscreenTxModal } from './components/modals/FullscreenTxModal';
import { 
  DeleteFlatConfirmModal, 
  DeleteTxConfirmModal, 
  DeleteDocConfirmModal, 
  QuickPayConfirmModal 
} from './components/modals/ConfirmModals';
import { 
  ForgotPasswordModal, 
  ResetPasswordModal, 
  ChangePasswordModal, 
  HelpModal 
} from './components/modals/AuthModals';

function MainLayout() {
  const { state, addTransaction, deleteItem, deleteFlat, deleteDocument } = useApp();
  const { currentUser } = state;

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modal states
  const [flatDetailNum, setFlatDetailNum] = useState(null);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [flatDetailAddTxNum, setFlatDetailAddTxNum] = useState(null);
  const [editTxData, setEditTxData] = useState(null); // { id, type }
  const [isGlobalBalancesOpen, setIsGlobalBalancesOpen] = useState(false);
  const [isAddFlatOpen, setIsAddFlatOpen] = useState(false);
  const [editFlatMasterData, setEditFlatMasterData] = useState(null); // { buildingId, flatNum }
  const [isFlatsDataOpen, setIsFlatsDataOpen] = useState(false);
  const [isFinancialSituationOpen, setIsFinancialSituationOpen] = useState(false);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [isLoansOpen, setIsLoansOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBuildingSelectorOpen, setIsBuildingSelectorOpen] = useState(false);
  const [isAddBuildingOpen, setIsAddBuildingOpen] = useState(false);
  const [fullscreenTxData, setFullscreenTxData] = useState(null); // { type, flatNum }

  // Confirm modals
  const [deleteFlatNum, setDeleteFlatNum] = useState(null);
  const [deleteTxData, setDeleteTxData] = useState(null); // { id, type }
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [quickPayData, setQuickPayData] = useState(null); // { flatNum, accountType, amount }

  // Auth modals
  const [isForgotPassOpen, setIsForgotPassOpen] = useState(false);
  const [resetPassData, setResetPassData] = useState(null); // { email, token }
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Parse URL on mount for reset_token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    const email = params.get('email');
    if (token && email) {
      setResetPassData({ email, token });
    }
  }, []);

  const handleDrawerOption = (action) => {
    switch (action) {
      case 'main':
        // Close all fullscreen modals
        setIsFlatsDataOpen(false);
        setIsFinancialSituationOpen(false);
        setIsDocumentsOpen(false);
        setIsLoansOpen(false);
        setIsProfileOpen(false);
        setFullscreenTxData(null);
        break;
      case 'finance':
        setIsFinancialSituationOpen(true);
        break;
      case 'flats-data':
        setIsFlatsDataOpen(true);
        break;
      case 'loans':
        setIsLoansOpen(true);
        break;
      case 'docs':
        setIsDocumentsOpen(true);
        break;
      case 'profile':
        setIsProfileOpen(true);
        break;
      case 'profile-switcher':
        setIsBuildingSelectorOpen(true);
        break;
      default:
        break;
    }
  };

  const handleQuickPayConfirm = (flatNum, targetAccount, amount) => {
    addTransaction({
      id: `t-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      flatNum,
      targetAccount,
      amount: Number(amount) || 0,
      status: "Verified",
      method: "Bank Transfer",
      comment: "Gyors befizetés",
      includeInBalance: true
    });
  };

  const handleGoHome = () => {
    setIsFlatsDataOpen(false);
    setIsFinancialSituationOpen(false);
    setIsDocumentsOpen(false);
    setIsLoansOpen(false);
    setIsProfileOpen(false);
    setFullscreenTxData(null);
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-gray-900 flex flex-col font-sans">
      
      {/* Header (shown when authenticated) */}
      <Header
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenProfileSelector={() => setIsBuildingSelectorOpen(true)}
        onGoHome={handleGoHome}
      />

      {/* Main View router */}
      <main className="flex-1 pb-12">
        {!currentUser ? (
          <LoginView
            onOpenForgotPassword={() => setIsForgotPassOpen(true)}
            onOpenHelp={() => setIsHelpOpen(true)}
          />
        ) : currentUser.role === 'admin' ? (
          <AdminView
            onOpenFlatDetail={(fNum) => setFlatDetailNum(fNum)}
            onOpenAddTransaction={() => setIsAddTxOpen(true)}
            onOpenAddFlat={() => setIsAddFlatOpen(true)}
            onOpenGlobalBalances={() => setIsGlobalBalancesOpen(true)}
            onOpenGlobalAddTx={() => setFlatDetailAddTxNum('Global')}
            onOpenEditFlatMaster={(bId, fNum) => setEditFlatMasterData({ buildingId: bId, flatNum: fNum })}
            onOpenEditTx={(id, type) => setEditTxData({ id, type })}
            onOpenDeleteFlatConfirm={(fNum) => setDeleteFlatNum(fNum)}
            onOpenDeleteTxConfirm={(id, type) => setDeleteTxData({ id, type })}
            onOpenQuickPayConfirm={(flatNum, accountType, amount) => setQuickPayData({ flatNum, accountType, amount })}
            onOpenFullscreenTx={(type) => setFullscreenTxData({ type })}
          />
        ) : (
          <TenantView
            onOpenFullscreenTx={(type) => setFullscreenTxData({ type, flatNum: currentUser.flatNum })}
          />
        )}
      </main>

      {/* iOS Side Drawer */}
      <IosSideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectOption={handleDrawerOption}
      />

      {/* Modals */}
      <FlatDetailModal
        flatNum={flatDetailNum}
        isOpen={Boolean(flatDetailNum)}
        onClose={() => setFlatDetailNum(null)}
        onOpenAddTx={(fNum) => setFlatDetailAddTxNum(fNum)}
        onOpenFullscreen={(type, fNum) => setFullscreenTxData({ type, flatNum: fNum })}
        onOpenDeleteTx={(id, type) => setDeleteTxData({ id, type })}
      />

      <TransactionModal
        isOpen={isAddTxOpen}
        onClose={() => setIsAddTxOpen(false)}
      />

      <FlatDetailAddTxModal
        flatNum={flatDetailAddTxNum}
        isOpen={Boolean(flatDetailAddTxNum)}
        onClose={() => setFlatDetailAddTxNum(null)}
      />

      <EditTransactionModal
        itemId={editTxData?.id}
        itemType={editTxData?.type}
        isOpen={Boolean(editTxData)}
        onClose={() => setEditTxData(null)}
      />

      <GlobalBalancesModal
        isOpen={isGlobalBalancesOpen}
        onClose={() => setIsGlobalBalancesOpen(false)}
      />

      <AddFlatModal
        isOpen={isAddFlatOpen}
        onClose={() => setIsAddFlatOpen(false)}
      />

      <EditFlatMasterModal
        buildingId={editFlatMasterData?.buildingId}
        flatNum={editFlatMasterData?.flatNum}
        isOpen={Boolean(editFlatMasterData)}
        onClose={() => setEditFlatMasterData(null)}
      />

      <FlatsDataModal
        isOpen={isFlatsDataOpen}
        onClose={() => setIsFlatsDataOpen(false)}
        onOpenEditFlatMaster={(bId, fNum) => setEditFlatMasterData({ buildingId: bId, flatNum: fNum })}
      />

      <FinancialSituationModal
        isOpen={isFinancialSituationOpen}
        onClose={() => setIsFinancialSituationOpen(false)}
      />

      <DocumentsModal
        isOpen={isDocumentsOpen}
        onClose={() => setIsDocumentsOpen(false)}
        onOpenDeleteDocConfirm={(docId) => setDeleteDocId(docId)}
      />

      <LoansModal
        isOpen={isLoansOpen}
        onClose={() => setIsLoansOpen(false)}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onOpenChangePassword={() => setIsChangePassOpen(true)}
        onOpenProfileSelector={() => setIsBuildingSelectorOpen(true)}
      />

      <BuildingSelectorModal
        isOpen={isBuildingSelectorOpen}
        onClose={() => setIsBuildingSelectorOpen(false)}
        onOpenAddBuilding={() => setIsAddBuildingOpen(true)}
      />

      <AddBuildingModal
        isOpen={isAddBuildingOpen}
        onClose={() => setIsAddBuildingOpen(false)}
      />

      <FullscreenTxModal
        isOpen={Boolean(fullscreenTxData)}
        type={fullscreenTxData?.type || 'global'}
        flatNum={fullscreenTxData?.flatNum || currentUser?.flatNum}
        onClose={() => setFullscreenTxData(null)}
        onOpenEditTx={(id, type) => setEditTxData({ id, type })}
        onOpenDeleteTx={(id, type) => setDeleteTxData({ id, type })}
      />

      {/* Confirm Modals */}
      <DeleteFlatConfirmModal
        isOpen={Boolean(deleteFlatNum)}
        flatNum={deleteFlatNum}
        onClose={() => setDeleteFlatNum(null)}
        onConfirm={(fNum) => deleteFlat(fNum)}
      />

      <DeleteTxConfirmModal
        isOpen={Boolean(deleteTxData)}
        itemId={deleteTxData?.id}
        itemType={deleteTxData?.type}
        onClose={() => setDeleteTxData(null)}
        onConfirm={(id, type) => deleteItem(id, type)}
      />

      <DeleteDocConfirmModal
        isOpen={Boolean(deleteDocId)}
        docId={deleteDocId}
        onClose={() => setDeleteDocId(null)}
        onConfirm={(id) => deleteDocument(id)}
      />

      <QuickPayConfirmModal
        isOpen={Boolean(quickPayData)}
        flatNum={quickPayData?.flatNum}
        accountType={quickPayData?.accountType}
        amount={quickPayData?.amount}
        onClose={() => setQuickPayData(null)}
        onConfirm={handleQuickPayConfirm}
      />

      {/* Auth Modals */}
      <ForgotPasswordModal
        isOpen={isForgotPassOpen}
        onClose={() => setIsForgotPassOpen(false)}
        onOpenResetWithToken={(email, token) => setResetPassData({ email, token })}
      />

      <ResetPasswordModal
        isOpen={Boolean(resetPassData)}
        email={resetPassData?.email}
        token={resetPassData?.token}
        onClose={() => setResetPassData(null)}
      />

      <ChangePasswordModal
        isOpen={isChangePassOpen}
        onClose={() => setIsChangePassOpen(false)}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
