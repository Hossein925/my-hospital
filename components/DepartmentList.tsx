import React, { useState } from 'react';
import { Department, UserRole } from '../types';
import Modal from './Modal';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { NewspaperIcon } from './icons/NewspaperIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { ChatIcon } from './icons/ChatIcon';

interface DepartmentListProps {
  departments: Department[];
  hospitalName: string;
  onAddDepartment: (name: string, managerName: string, managerNationalId: string, managerPassword: string, staffCount: number, bedCount: number) => void;
  onUpdateDepartment: (id: string, updatedData: Partial<Omit<Department, 'id' | 'staff'>>) => void;
  onDeleteDepartment: (id: string) => void;
  onSelectDepartment: (id: string) => void;
  onBack: () => void;
  onManageAccreditation: () => void;
  onManageNewsBanners: () => void;
  onResetHospital: (supervisorNationalId: string, supervisorPassword: string) => boolean;
  onContactAdmin: () => void;
  userRole: UserRole;
}

const DepartmentList: React.FC<DepartmentListProps> = ({
  departments,
  hospitalName,
  onAddDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
  onSelectDepartment,
  onBack,
  onManageAccreditation,
  onManageNewsBanners,
  onResetHospital,
  onContactAdmin,
  userRole,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerNationalId, setNewManagerNationalId] = useState('');
  const [newManagerPassword, setNewManagerPassword] = useState('');
  const [newStaffCount, setNewStaffCount] = useState('');
  const [newBedCount, setNewBedCount] = useState('');

  // State for reset modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: confirm, 2: credentials
  const [supervisorIdInput, setSupervisorIdInput] = useState('');
  const [supervisorPasswordInput, setSupervisorPasswordInput] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  const resetForm = () => {
      setNewDepartmentName('');
      setNewManagerName('');
      setNewManagerNationalId('');
      setNewManagerPassword('');
      setNewStaffCount('');
      setNewBedCount('');
      setEditingDepartment(null);
  }

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (dep: Department) => {
    setEditingDepartment(dep);
    setNewDepartmentName(dep.name);
    setNewManagerName(dep.managerName);
    setNewManagerNationalId(dep.managerNationalId);
    setNewManagerPassword(dep.managerPassword);
    setNewStaffCount(String(dep.staffCount));
    setNewBedCount(String(dep.bedCount));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    resetForm();
    setIsModalOpen(false);
  };
  
  const handleSaveDepartment = () => {
    if (newDepartmentName.trim() && newManagerName.trim() && newManagerNationalId.trim() && newManagerPassword.trim() && newStaffCount && newBedCount) {
      const staffCountNum = parseInt(newStaffCount, 10);
      const bedCountNum = parseInt(newBedCount, 10);
      
      if(editingDepartment) {
        onUpdateDepartment(editingDepartment.id, {
          name: newDepartmentName.trim(),
          managerName: newManagerName.trim(),
          managerNationalId: newManagerNationalId.trim(),
          managerPassword: newManagerPassword.trim(),
          staffCount: staffCountNum,
          bedCount: bedCountNum,
        });
      } else {
        onAddDepartment(
          newDepartmentName.trim(), 
          newManagerName.trim(),
          newManagerNationalId.trim(),
          newManagerPassword.trim(),
          staffCountNum,
          bedCountNum
        );
      }
      resetForm();
      setIsModalOpen(false);
    } else {
        alert("لطفاً تمام فیلدها را پر کنید.")
    }
  };

  // --- Reset Hospital Modal Handlers ---
  const resetResetModal = () => {
    setIsResetModalOpen(false);
    setTimeout(() => {
        setResetStep(1);
        setSupervisorIdInput('');
        setSupervisorPasswordInput('');
        setResetError(null);
    }, 300); // Delay reset to allow modal to close gracefully
  };

  const handleOpenResetModal = () => {
    setResetError(null);
    setResetStep(1);
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = () => {
    const success = onResetHospital(supervisorIdInput, supervisorPasswordInput);
    if (success) {
      alert('تمام بخش‌های بیمارستان با موفقیت حذف شدند.');
      resetResetModal();
    } else {
      setResetError('کد ملی یا رمز عبور سوپروایزر نامعتبر است.');
    }
  };


  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">بخش های بیمارستان: <span className="text-slate-600 dark:text-slate-400">{hospitalName}</span></h1>
        <div className="flex items-center gap-2">
            {userRole === UserRole.Supervisor && (
              <button
                onClick={onContactAdmin}
                className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
              >
                <ChatIcon className="w-5 h-5" />
                تماس با ادمین کل
              </button>
            )}
            <button
              onClick={onManageNewsBanners}
              className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
            >
              <NewspaperIcon className="w-5 h-5" />
              افزودن بنرهای خبری
            </button>
            <button
              onClick={onManageAccreditation}
              className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              <ShieldCheckIcon className="w-5 h-5" />
              مطالب اعتباربخشی
            </button>
            {(userRole === UserRole.Admin || userRole === UserRole.Supervisor) && (
              <button
                onClick={handleOpenResetModal}
                className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <RefreshIcon className="w-5 h-5" />
                ریست کردن بیمارستان
              </button>
            )}
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="w-5 h-5" />
              افزودن بخش جدید
            </button>
        </div>
      </div>

      {departments.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl shadow">
            <h2 className="text-xl font-medium text-slate-500">هیچ بخشی یافت نشد.</h2>
            <p className="text-slate-400 mt-2">برای شروع، یک بخش جدید اضافه کنید.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {departments.map((dep) => (
            <div
              key={dep.id}
              className="relative group bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 border-t-4 border-indigo-500 transition-all duration-300 hover:-translate-y-1"
            >
              <div
                onClick={() => onSelectDepartment(dep.id)}
                className="p-6 cursor-pointer"
              >
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{dep.name}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{dep.staff.length} نفر پرسنل</p>
              </div>
              <div className="absolute top-3 left-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); handleOpenEditModal(dep); }}
                    className="p-2 text-slate-400 hover:text-indigo-500 bg-slate-100 dark:bg-slate-700 rounded-full"
                    aria-label="Edit Department"
                >
                    <EditIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if(window.confirm(`آیا از حذف بخش "${dep.name}" مطمئن هستید؟`)) {
                      onDeleteDepartment(dep.id);
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-red-500 bg-slate-100 dark:bg-slate-700 rounded-full"
                  aria-label="Delete Department"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingDepartment ? "ویرایش مشخصات بخش" : "افزودن بخش جدید"}>
        <div className="space-y-4">
          <input
            type="text"
            value={newDepartmentName}
            onChange={(e) => setNewDepartmentName(e.target.value)}
            placeholder="نام بخش (مثال: اورژانس)"
            className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
           <input
            type="text"
            value={newManagerName}
            onChange={(e) => setNewManagerName(e.target.value)}
            placeholder="نام مسئول بخش"
            className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            inputMode="numeric"
            value={newManagerNationalId}
            onChange={(e) => setNewManagerNationalId(e.target.value.replace(/\D/g, ''))}
            placeholder="کد ملی مسئول بخش"
            className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            value={newManagerPassword}
            onChange={(e) => setNewManagerPassword(e.target.value)}
            placeholder="رمز ورود مسئول بخش"
            className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
           <input
            type="number"
            value={newStaffCount}
            onChange={(e) => setNewStaffCount(e.target.value)}
            placeholder="تعداد نیروی بخش"
            className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
           <input
            type="number"
            value={newBedCount}
            onChange={(e) => setNewBedCount(e.target.value)}
            placeholder="تعداد تخت های بخش"
            className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex justify-end gap-3">
            <button
                onClick={handleCloseModal}
                className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
            >
                انصراف
            </button>
            <button
                onClick={handleSaveDepartment}
                className="px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
                {editingDepartment ? 'ذخیره تغییرات' : 'افزودن'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isResetModalOpen} onClose={resetResetModal} title="ریست کردن اطلاعات بیمارستان">
        {resetStep === 1 && (
            <div className="text-center">
                <p className="text-lg mb-6">آیا مایل به پاک کردن تمام بخش ها هستین؟ این عمل غیرقابل بازگشت است.</p>
                <div className="flex justify-center gap-4">
                    <button
                        onClick={resetResetModal}
                        className="px-6 py-2 font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
                    >
                        خیر
                    </button>
                    <button
                        onClick={() => setResetStep(2)}
                        className="px-6 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700"
                    >
                        بله، ادامه
                    </button>
                </div>
            </div>
        )}
        {resetStep === 2 && (
            <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">برای تایید، لطفاً کد ملی و رمز عبور سوپروایزر آموزشی این بیمارستان را وارد کنید.</p>
                <input
                    type="text"
                    inputMode="numeric"
                    value={supervisorIdInput}
                    onChange={(e) => { setSupervisorIdInput(e.target.value.replace(/\D/g, '')); setResetError(null); }}
                    placeholder="کد ملی سوپروایزر"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                    type="password"
                    value={supervisorPasswordInput}
                    onChange={(e) => { setSupervisorPasswordInput(e.target.value); setResetError(null); }}
                    placeholder="رمز عبور سوپروایزر"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {resetError && <p className="text-red-500 text-sm text-center">{resetError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={resetResetModal}
                        className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
                    >
                        انصراف
                    </button>
                    <button
                        onClick={handleConfirmReset}
                        className="px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700"
                    >
                        تایید و حذف تمام بخش‌ها
                    </button>
                </div>
            </div>
        )}
      </Modal>

    </div>
  );
};

export default DepartmentList;