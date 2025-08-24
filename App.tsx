

import React, { useState, useEffect } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { Department, StaffMember, View, SkillCategory, Assessment, Hospital, AppScreen, NamedChecklistTemplate, ExamTemplate, ExamSubmission, LoggedInUser, UserRole, TrainingMaterial, MonthlyTraining, NewsBanner, MonthlyWorkLog, Patient, ChatMessage, AdminMessage } from './types';
import WelcomeScreen from './components/WelcomeScreen';
import HospitalList from './components/HospitalList';
import DepartmentList from './components/DepartmentList';
import DepartmentView from './components/DepartmentView';
import StaffMemberView from './components/StaffMemberView';
import ChecklistManager from './components/ChecklistManager';
import ExamManager from './components/ExamManager';
import TrainingManager from './components/TrainingManager';
import AccreditationManager from './components/AccreditationManager';
import NewsBannerManager from './components/NewsBannerManager';
import PatientEducationManager from './components/PatientEducationManager';
import PatientPortalView from './components/PatientPortalView';
import AboutModal from './components/AboutModal';
import LoginModal from './components/LoginModal';
import { SaveIcon } from './components/icons/SaveIcon';
import { UploadIcon } from './components/icons/UploadIcon';
import { InfoIcon } from './components/icons/InfoIcon';
import { LogoutIcon } from './components/icons/LogoutIcon';
import { BackIcon } from './components/icons/BackIcon';
import * as db from './services/db';
import AdminCommunicationView from './components/AdminCommunicationView';
import HospitalCommunicationView from './components/HospitalCommunicationView';

const PERSIAN_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد",
  "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر",
  "دی", "بهمن", "اسفند"
];

type MessageContent = { text?: string; file?: { id: string; name: string; type: string } };

const App: React.FC = () => {
  const [hospitals, setHospitals] = useLocalStorage<Hospital[]>('skill-assessment-data-v4', []);
  const [appScreen, setAppScreen] = useState<AppScreen>(AppScreen.Welcome);
  const [currentView, setCurrentView] = useState<View>(View.DepartmentList);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);

  // Initialize IndexedDB
  useEffect(() => {
    db.initDB().then(success => {
        if (!success) {
            alert('Failed to initialize the database. The app might not work correctly for file uploads.');
        }
    });
  }, []);

  const handleGoToWelcome = () => {
    setAppScreen(AppScreen.Welcome);
    setSelectedHospitalId(null);
    setSelectedDepartmentId(null);
    setSelectedStaffId(null);
    setCurrentView(View.DepartmentList);
    setLoggedInUser(null);
  }

  const findHospital = (hospitalId: string | null) => hospitals.find(h => h.id === hospitalId);
  const findDepartment = (hospital: Hospital | undefined, departmentId: string | null) => hospital?.departments.find(d => d.id === departmentId);
  const findStaffMember = (department: Department | undefined, staffId: string | null) => department?.staff.find(s => s.id === staffId);

  // --- Data Handlers ---

  const handleSaveData = async () => {
    try {
        const hospital = findHospital(selectedHospitalId);
        const department = findDepartment(hospital, selectedDepartmentId);

        let dataToSave: any;
        let fileName = `skill_assessment_data_${new Date().toISOString().split('T')[0]}.json`;

        // Scope: Department (inside DepartmentView or StaffMemberView)
        if (department && hospital && (currentView === View.DepartmentView || currentView === View.StaffMemberView || currentView === View.PatientEducationManager)) {
            dataToSave = {
                type: 'department',
                data: department,
                context: {
                    hospitalId: hospital.id,
                    hospitalName: hospital.name,
                }
            };
            fileName = `skill_assessment_DEPT_${department.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        }
        // Scope: Hospital (inside DepartmentList, ChecklistManager, etc.)
        else if (hospital) {
            const materialIds = new Set<string>();
            hospital.trainingMaterials?.forEach(monthly => {
                monthly.materials.forEach(material => materialIds.add(material.id));
            });
            hospital.accreditationMaterials?.forEach(material => materialIds.add(material.id));
            hospital.departments.forEach(dept => {
                dept.patientEducationMaterials?.forEach(material => materialIds.add(material.id));
                dept.patients?.forEach(p => {
                    p.chatHistory?.forEach(msg => {
                        if (msg.file) materialIds.add(msg.file.id);
                    });
                });
            });
            hospital.newsBanners?.forEach(banner => materialIds.add(banner.imageId));
            hospital.adminMessages?.forEach(msg => {
              if (msg.file) materialIds.add(msg.file.id);
            });

            const allDbMaterials = await db.getAllMaterials();
            const hospitalDbData = allDbMaterials.filter(m => materialIds.has(m.id));

            dataToSave = {
                type: 'hospital',
                data: hospital,
                dbData: hospitalDbData
            };

            fileName = `skill_assessment_HOSPITAL_${hospital.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        }
        // Scope: All data
        else {
            const allDbMaterials = await db.getAllMaterials();
            dataToSave = {
                type: 'all_hospitals',
                data: hospitals,
                dbData: allDbMaterials
            };

            fileName = `skill_assessment_ALL_${new Date().toISOString().split('T')[0]}.json`;
        }

        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToSave, null, 2))}`;
        const link = document.createElement('a');
        link.href = jsonString;
        link.download = fileName;
        link.click();

    } catch (error) {
        console.error('Failed to save data:', error);
        alert('خطا در ذخیره سازی داده ها.');
    }
  };

  const handleLoadData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const loadedData = JSON.parse(text);
          const { type, data, dbData, context } = loadedData;

          const scopeInfo = getScope();
          const currentHospital = findHospital(selectedHospitalId);
          const currentDepartment = findDepartment(currentHospital, selectedDepartmentId);

          const legacyFormat = !type && Array.isArray(loadedData);
          const effectiveType = legacyFormat ? 'all_hospitals' : type;

          if (effectiveType === 'department') {
            if (scopeInfo.scope !== 'department' || !currentHospital || !currentDepartment) {
              alert('خطا: فایل بارگذاری شده مربوط به یک بخش است. لطفاً ابتدا وارد بخش مورد نظر خود شوید تا بتوانید اطلاعات آن را جایگزین کنید.');
              return;
            }
            if (context?.hospitalId !== currentHospital.id) {
              alert(`خطا: این فایل متعلق به بیمارستان دیگری است ("${context?.hospitalName}"). شما نمی‌توانید آن را در بیمارستان فعلی بارگذاری کنید.`);
              return;
            }

            const loadedDept = data as Department;
            if (window.confirm(`آیا مطمئن هستید که می‌خواهید اطلاعات بخش فعلی ("${currentDepartment.name}") را با اطلاعات بخش "${loadedDept.name}" از فایل جایگزین کنید؟ این عمل غیرقابل بازگشت است.`)) {
                setHospitals(hospitals.map(h =>
                     h.id === currentHospital.id
                     ? { ...h, departments: h.departments.map(d => d.id === currentDepartment.id ? loadedDept : d) }
                     : h
                ));
                // FIX: Update selected department ID to prevent errors after re-render
                setSelectedDepartmentId(loadedDept.id);
                alert(`داده های بخش "${loadedDept.name}" با موفقیت بارگذاری و جایگزین بخش فعلی شد.`);
            }

          } else if (effectiveType === 'hospital') {
            const loadedHosp = data as Hospital;
            const loadedDbData = dbData;

            const overwriteHospital = async (hospitalToOverwrite: Hospital, loadedHospitalData: Hospital, loadedDb: any[]) => {
                const oldMaterialIds = new Set<string>();
                hospitalToOverwrite.trainingMaterials?.forEach(m => m.materials.forEach(mat => oldMaterialIds.add(mat.id)));
                hospitalToOverwrite.accreditationMaterials?.forEach(mat => oldMaterialIds.add(mat.id));
                hospitalToOverwrite.departments.forEach(d => {
                    d.patientEducationMaterials?.forEach(mat => oldMaterialIds.add(mat.id));
                    d.patients?.forEach(p => {
                        p.chatHistory?.forEach(msg => {
                            if (msg.file) oldMaterialIds.add(msg.file.id);
                        });
                    });
                });
                hospitalToOverwrite.newsBanners?.forEach(b => oldMaterialIds.add(b.imageId));
                hospitalToOverwrite.adminMessages?.forEach(msg => {
                    if (msg.file) oldMaterialIds.add(msg.file.id);
                });

                for (const id of oldMaterialIds) { await db.deleteMaterial(id); }

                if (loadedDb && Array.isArray(loadedDb)) {
                    for (const material of loadedDb) { await db.addMaterial(material); }
                }

                const wasSelected = selectedHospitalId === hospitalToOverwrite.id;

                setHospitals(hospitals.map(h => h.id === hospitalToOverwrite.id ? loadedHospitalData : h));

                // FIX: If the overwritten hospital was selected, update the ID to the new one
                if (wasSelected) {
                    setSelectedHospitalId(loadedHospitalData.id);
                }

                alert(`داده های بیمارستان "${loadedHospitalData.name}" با موفقیت جایگزین شد.`);
            };

            if (scopeInfo.scope === 'hospital' && currentHospital) {
                if (window.confirm(`آیا مطمئن هستید که می‌خواهید تمام اطلاعات بیمارستان فعلی ("${currentHospital.name}") را با اطلاعات بیمارستان "${loadedHosp.name}" از فایل جایگزین کنید؟ این عمل غیرقابل بازگشت است.`)) {
                    await overwriteHospital(currentHospital, loadedHosp, loadedDbData);
                }
            } else if (scopeInfo.scope === 'all') {
                const existingHospital = hospitals.find(h => h.id === loadedHosp.id);
                if (existingHospital) {
                    if (window.confirm(`بیمارستانی با نام "${loadedHosp.name}" از قبل وجود دارد. آیا می‌خواهید اطلاعات آن را با اطلاعات فایل جایگزین کنید؟`)) {
                        await overwriteHospital(existingHospital, loadedHosp, loadedDbData);
                    }
                } else {
                    if (window.confirm(`بیمارستان "${loadedHosp.name}" در لیست شما وجود ندارد. آیا می‌خواهید آن را به عنوان بیمارستان جدید اضافه کنید؟`)) {
                        if (loadedDbData && Array.isArray(loadedDbData)) {
                            for (const material of loadedDbData) { await db.addMaterial(material); }
                        }
                        setHospitals([...hospitals, loadedHosp]);
                        alert(`بیمارستان "${loadedHosp.name}" با موفقیت اضافه شد.`);
                    }
                }
            } else {
                alert('برای بارگذاری فایل بیمارستان، باید در صفحه لیست بیمارستان‌ها یا داخل یک بیمارستان باشید.');
                return;
            }

          } else if (effectiveType === 'all_hospitals') {
            if (scopeInfo.scope !== 'all') {
              alert('خطا: فایل بارگذاری شده شامل اطلاعات تمام بیمارستان‌ها است. برای بارگذاری آن، لطفاً به صفحه اصلی (لیست بیمارستان‌ها) بازگردید.');
              return;
            }

            if (window.confirm('آیا مطمئن هستید که می‌خواهید کل داده‌های برنامه را با اطلاعات این فایل جایگزین کنید؟ تمام اطلاعات فعلی حذف خواهد شد.')) {
                const hospitalsToLoad = data || loadedData;
                const dbDataToLoad = dbData;

                if (!Array.isArray(hospitalsToLoad)) throw new Error("Invalid format for hospitals data.");

                await db.clearAllMaterials();

                if (dbDataToLoad) { // New format with separate dbData
                    for(const material of dbDataToLoad) { await db.addMaterial(material); }
                    setHospitals(hospitalsToLoad);
                    alert('کل داده‌های برنامه با موفقیت بارگذاری شد!');
                } else { // Old format, migration needed
                    const migrationPromises: Promise<any>[] = [];
                    for (const h of hospitalsToLoad) {
                        if (h.trainingMaterials) {
                            for (const monthly of h.trainingMaterials) {
                                for (const material of monthly.materials) {
                                    if (material.data) {
                                        migrationPromises.push(db.addMaterial({id: material.id, data: material.data}));
                                        delete material.data;
                                    }
                                }
                            }
                        }
                        if (h.accreditationMaterials) {
                            for (const material of h.accreditationMaterials) {
                               if (material.data) {
                                    migrationPromises.push(db.addMaterial({id: material.id, data: material.data}));
                                    delete material.data;
                                }
                            }
                        }
                    }
                    await Promise.all(migrationPromises);
                    setHospitals(hospitalsToLoad);
                    alert('داده‌های نسخه قدیمی با موفقیت بارگذاری و منتقل شد!');
                }
            }
          } else {
            alert('فرمت فایل نامعتبر است یا در جای اشتباهی در حال بارگذاری آن هستید.');
          }

        } catch (error) {
          console.error('Failed to load data:', error);
          alert('خطا در بارگذاری داده. فایل ممکن است خراب یا با فرمت نامعتبر باشد.');
        } finally {
          if (event.target) event.target.value = '';
        }
      };
      reader.readAsText(file);
    }
  };

  // --- Navigation Handlers ---

  const handleSelectHospital = (id: string) => {
    setSelectedHospitalId(id);
    setAppScreen(AppScreen.MainApp);
    setCurrentView(View.DepartmentList);
  };

  const handleSelectDepartment = (id: string) => {
    setSelectedDepartmentId(id);
    setCurrentView(View.DepartmentView);
  };

  const handleSelectStaff = (id: string) => {
    setSelectedStaffId(id);
    setCurrentView(View.StaffMemberView);
  };

  const handleBack = () => {
    switch (currentView) {
      case View.StaffMemberView:
        setSelectedStaffId(null);
        setCurrentView(View.DepartmentView);
        break;
      case View.DepartmentView:
      case View.ChecklistManager:
      case View.ExamManager:
      case View.TrainingManager:
      case View.AccreditationManager:
      case View.NewsBannerManager:
      case View.PatientEducationManager:
      case View.HospitalCommunication:
        setSelectedDepartmentId(null);
        setCurrentView(View.DepartmentList);
        break;
      case View.AdminCommunication:
         setCurrentView(View.DepartmentList);
         break;
      case View.DepartmentList:
        setSelectedHospitalId(null);
        setAppScreen(AppScreen.HospitalList);
        break;
    }
  };

  // --- Hospital Handlers ---
  const handleAddHospital = (name: string, province: string, city: string, supervisorName: string, supervisorNationalId: string, supervisorPassword: string) => {
    const newHospital: Hospital = {
      id: Date.now().toString(),
      name,
      province,
      city,
      supervisorName,
      supervisorNationalId,
      supervisorPassword,
      departments: [],
      checklistTemplates: [],
      examTemplates: [],
      trainingMaterials: [],
      accreditationMaterials: [],
      newsBanners: [],
    };
    setHospitals([...hospitals, newHospital]);
  };

  const handleUpdateHospital = (id: string, updatedData: Partial<Omit<Hospital, 'id' | 'departments' | 'checklistTemplates' | 'examTemplates' | 'trainingMaterials' | 'newsBanners'>>) => {
      setHospitals(hospitals.map(h => h.id === id ? { ...h, ...updatedData } : h));
  }

  const handleDeleteHospital = (id: string) => {
    setHospitals(hospitals.filter(h => h.id !== id));
  };

  // --- Department Handlers ---

  const handleAddDepartment = (name: string, managerName: string, managerNationalId: string, managerPassword: string, staffCount: number, bedCount: number) => {
    const newDepartment: Department = { id: Date.now().toString(), name, managerName, managerNationalId, managerPassword, staffCount, bedCount, staff: [] };
    setHospitals(
      hospitals.map(h =>
        h.id === selectedHospitalId
          ? { ...h, departments: [...h.departments, newDepartment] }
          : h
      )
    );
  };

  const handleUpdateDepartment = (id: string, updatedData: Partial<Omit<Department, 'id' | 'staff'>>) => {
    setHospitals(hospitals.map(h => {
        if (h.id === selectedHospitalId) {
            return {
                ...h,
                departments: h.departments.map(d => d.id === id ? { ...d, ...updatedData } : d)
            };
        }
        return h;
    }));
  }

  const handleDeleteDepartment = (id: string) => {
    setHospitals(
      hospitals.map(h =>
        h.id === selectedHospitalId
          ? { ...h, departments: h.departments.filter(d => d.id !== id) }
          : h
      )
    );
  };

  const handleResetHospital = (supervisorNationalId: string, supervisorPassword: string): boolean => {
    const hospital = findHospital(selectedHospitalId);
    if (!hospital) {
        return false;
    }

    if (hospital.supervisorNationalId === supervisorNationalId && hospital.supervisorPassword === supervisorPassword) {
        setHospitals(hospitals.map(h =>
            h.id === selectedHospitalId
            ? { ...h, departments: [] }
            : h
        ));
        return true;
    }
    return false;
  };

  // --- Staff Handlers ---

  const handleAddStaff = (departmentId: string, name: string, title: string, nationalId: string, password?: string) => {
    const newStaff: StaffMember = { id: Date.now().toString(), name, title, nationalId, password, assessments: [] };
    setHospitals(
      hospitals.map(h =>
        h.id === selectedHospitalId
          ? {
              ...h,
              departments: h.departments.map(d =>
                d.id === departmentId ? { ...d, staff: [...d.staff, newStaff] } : d
              )
            }
          : h
      )
    );
  };

  const handleUpdateStaff = (departmentId: string, staffId: string, updatedData: Partial<Omit<StaffMember, 'id' | 'assessments'>>) => {
      setHospitals(hospitals.map(h => {
          if (h.id === selectedHospitalId) {
              return {
                  ...h,
                  departments: h.departments.map(d => {
                      if (d.id === departmentId) {
                          return { ...d, staff: d.staff.map(s => s.id === staffId ? { ...s, ...updatedData } : s)};
                      }
                      return d;
                  })
              }
          }
          return h;
      }));
  };

  const handleDeleteStaff = (departmentId: string, staffId: string) => {
      setHospitals(hospitals.map(h => {
          if (h.id === selectedHospitalId) {
              return {
                  ...h,
                  departments: h.departments.map(d =>
                     d.id === departmentId
                       ? { ...d, staff: d.staff.filter(s => s.id !== staffId) }
                      : d
                  )
              };
          }
          return h;
      }));
  };

  const handleAddOrUpdateAssessment = (departmentId: string, staffId: string, month: string, skills: SkillCategory[], template?: NamedChecklistTemplate) => {
      setHospitals(hospitals.map(h => {
        if (h.id === selectedHospitalId) {
          return {
            ...h,
            departments: h.departments.map(d => {
              if (d.id === departmentId) {
                return {
                  ...d,
                  staff: d.staff.map(s => {
                    if (s.id === staffId) {
                      const existingAssessmentIndex = s.assessments.findIndex(a => a.month === month);
                      const newAssessment: Assessment = {
                        id: existingAssessmentIndex > -1 ? s.assessments[existingAssessmentIndex].id : Date.now().toString(),
                        month,
                        skillCategories: skills,
                        supervisorMessage: existingAssessmentIndex > -1 ? s.assessments[existingAssessmentIndex].supervisorMessage : '',
                        managerMessage: existingAssessmentIndex > -1 ? s.assessments[existingAssessmentIndex].managerMessage : '',
                        templateId: template?.id,
                        minScore: template?.minScore,
                        maxScore: template?.maxScore,
                        examSubmissions: existingAssessmentIndex > -1 ? s.assessments[existingAssessmentIndex].examSubmissions : [],
                      };

                       if (existingAssessmentIndex > -1) {
                        const updatedAssessments = [...s.assessments];
                        updatedAssessments[existingAssessmentIndex] = newAssessment;
                        return { ...s, assessments: updatedAssessments };
                      } else {
                        return { ...s, assessments: [...s.assessments, newAssessment] };
                      }
                    }
                    return s;
                  })
                };
              }
              return d;
            })
          };
        }
        return h;
      }));
  };

  const handleUpdateAssessmentMessages = (departmentId: string, staffId: string, month: string, messages: { supervisorMessage: string; managerMessage: string; }) => {
    setHospitals(hospitals.map(h => {
      if (h.id === selectedHospitalId) {
        return {
          ...h,
          departments: h.departments.map(d => {
            if (d.id === departmentId) {
              return {
                ...d,
                staff: d.staff.map(s => {
                  if (s.id === staffId) {
                    return {
                      ...s,
                      assessments: s.assessments.map(a =>
                        a.month === month ? { ...a, ...messages } : a
                      )
                    };
                  }
                  return s;
                })
              };
            }
            return d;
          })
        };
      }
      return h;
    }));
  };

  const handleComprehensiveImport = (departmentId: string, data: { [staffName: string]: Map<string, SkillCategory[]> }) => {

     setHospitals(hospitals.map(h => {
        if (h.id === selectedHospitalId) {
            return {
                ...h,
                departments: h.departments.map(d => {
                    if (d.id === departmentId) {
                        let updatedStaff = [...d.staff];
                        const existingStaffNames = new Set(updatedStaff.map(s => s.name));

                        for (const staffName in data) {
                            const assessmentsMap = data[staffName];
                            const newAssessments: Assessment[] = Array.from(assessmentsMap.entries()).map(([month, categories]) => ({
                                id: `${staffName}-${month}-${Date.now()}`,
                                month,
                                skillCategories: categories,
                                maxScore: 4, // Default from Excel parser
                                minScore: 0,
                            }));

                            const staffIndex = updatedStaff.findIndex(s => s.name === staffName);
                            if (staffIndex > -1) {
                                // Update existing staff
                                const existingStaff = updatedStaff[staffIndex];
                                const assessmentsToUpdate = new Map(existingStaff.assessments.map(a => [a.month, a]));
                                newAssessments.forEach(newA => assessmentsToUpdate.set(newA.month, newA));
                                updatedStaff[staffIndex] = { ...existingStaff, assessments: Array.from(assessmentsToUpdate.values()) };
                            } else {
                                // Add new staff
                                const newStaff: StaffMember = {
                                    id: Date.now().toString() + staffName,
                                    name: staffName,
                                    title: 'پرسنل',
                                    assessments: newAssessments,
                                };
                                updatedStaff.push(newStaff);
                            }
                        }
                        return { ...d, staff: updatedStaff };
                    }
                    return d;
                })
            };
        }
        return h;
     }));

     alert("داده‌های جامع با موفقیت بارگذاری شد.");
  };

  const handleAddOrUpdateChecklistTemplate = (template: NamedChecklistTemplate) => {
    setHospitals(hospitals.map(h => {
        if (h.id === selectedHospitalId) {
            const templates = h.checklistTemplates || [];
            const existingIndex = templates.findIndex(t => t.id === template.id);
            if (existingIndex > -1) {
                templates[existingIndex] = template;
            } else {
                templates.push(template);
            }
            return { ...h, checklistTemplates: templates };
        }
        return h;
    }));
  };

  const handleDeleteChecklistTemplate = (templateId: string) => {
    setHospitals(hospitals.map(h => {
        if (h.id === selectedHospitalId) {
            const templates = (h.checklistTemplates || []).filter(t => t.id !== templateId);
            return { ...h, checklistTemplates: templates };
        }
        return h;
    }));
  };

  const handleAddOrUpdateExamTemplate = (template: ExamTemplate) => {
    setHospitals(hospitals.map(h => {
        if (h.id === selectedHospitalId) {
            const templates = h.examTemplates || [];
            const existingIndex = templates.findIndex(t => t.id === template.id);
            if (existingIndex > -1) {
                templates[existingIndex] = template;
            } else {
                templates.push(template);
            }
            return { ...h, examTemplates: templates };
        }
        return h;
    }));
  };

  const handleDeleteExamTemplate = (templateId: string) => {
    setHospitals(hospitals.map(h => {
        if (h.id === selectedHospitalId) {
            const templates = (h.examTemplates || []).filter(t => t.id !== templateId);
            return { ...h, examTemplates: templates };
        }
        return h;
    }));
  };

  const handleSubmitExam = (departmentId: string, staffId: string, month: string, submission: ExamSubmission) => {
      setHospitals(hospitals.map(h => {
        if (h.id === selectedHospitalId) {
          return {
            ...h,
            departments: h.departments.map(d => {
              if (d.id === departmentId) {
                return {
                  ...d,
                  staff: d.staff.map(s => {
                    if (s.id === staffId) {
                      return {
                        ...s,
                        assessments: s.assessments.map(a => {
                          if (a.month === month) {
                            const submissions = a.examSubmissions || [];
                            return { ...a, examSubmissions: [...submissions, submission] };
                          }
                          return a;
                        })
                      };
                    }
                    return s;
                  })
                };
              }
              return d;
            })
          };
        }
        return h;
      }));
  }

  const handleAddOrUpdateWorkLog = (departmentId: string, staffId: string, workLog: MonthlyWorkLog) => {
    setHospitals(hospitals.map(h => {
      if (h.id === selectedHospitalId) {
        return {
          ...h,
          departments: h.departments.map(d => {
            if (d.id === departmentId) {
              return {
                ...d,
                staff: d.staff.map(s => {
                  if (s.id === staffId) {
                    const workLogs = s.workLogs ? [...s.workLogs] : [];
                    const existingLogIndex = workLogs.findIndex(l => l.month === workLog.month);

                    if (existingLogIndex > -1) {
                      workLogs[existingLogIndex] = workLog;
                    } else {
                      workLogs.push(workLog);
                    }

                    return { ...s, workLogs };
                  }
                  return s;
                })
              };
            }
            return d;
          })
        };
      }
      return h;
    }));
  };

  // --- Training Handlers ---
  const handleAddTrainingMaterial = async (month: string, material: TrainingMaterial) => {
      if (!material.data) {
          alert("Error: Material data is missing.");
          return;
      }

      try {
        await db.addMaterial({ id: material.id, data: material.data });

        // Create a version of the material to store in localStorage without the large data part
        const materialMetadata: TrainingMaterial = { ...material };
        delete materialMetadata.data;

        setHospitals(hospitals.map(h => {
            if (h.id === selectedHospitalId) {
                const materialsByMonth = h.trainingMaterials ? [...h.trainingMaterials] : [];
                const monthIndex = materialsByMonth.findIndex(t => t.month === month);

                if (monthIndex > -1) {
                    materialsByMonth[monthIndex].materials.push(materialMetadata);
                } else {
                    materialsByMonth.push({ month, materials: [materialMetadata] });
                    // Sort by Persian month order
                    materialsByMonth.sort((a,b) => PERSIAN_MONTHS.indexOf(a.month) - PERSIAN_MONTHS.indexOf(b.month));
                }
                return { ...h, trainingMaterials: materialsByMonth };
            }
            return h;
        }));
      } catch (error) {
          console.error("Failed to add training material:", error);
          alert("Failed to save material to the database.");
      }
  };

  const handleDeleteTrainingMaterial = async (month: string, materialId: string) => {
      try {
        await db.deleteMaterial(materialId);

        setHospitals(hospitals.map(h => {
            if (h.id === selectedHospitalId) {
                const materialsByMonth = (h.trainingMaterials || []).map(monthly => {
                    if (monthly.month === month) {
                        return {
                            ...monthly,
                            materials: monthly.materials.filter(m => m.id !== materialId)
                        };
                    }
                    return monthly;
                }).filter(monthly => monthly.materials.length > 0); // Remove month if it becomes empty
                return { ...h, trainingMaterials: materialsByMonth };
            }
            return h;
        }));
      } catch (error) {
          console.error("Failed to delete training material:", error);
          alert("Failed to delete material from the database.");
      }
  };

  const handleUpdateMaterialDescription = (month: string, materialId: string, description: string) => {
    setHospitals(hospitals.map(h => {
        if (h.id === selectedHospitalId) {
            const materialsByMonth = (h.trainingMaterials || []).map(monthly => {
                if (monthly.month === month) {
                    return {
                        ...monthly,
                        materials: monthly.materials.map(m => m.id === materialId ? { ...m, description } : m)
                    };
                }
                return monthly;
            });
            return { ...h, trainingMaterials: materialsByMonth };
        }
        return h;
    }));
  };

  // --- Accreditation Handlers ---
  const handleAddAccreditationMaterial = async (material: TrainingMaterial) => {
        if (!material.data || !selectedHospitalId) {
            alert("Error: Material data or hospital is missing.");
            return;
        }

        try {
            await db.addMaterial({ id: material.id, data: material.data });

            const materialMetadata: TrainingMaterial = { ...material };
            delete materialMetadata.data;

            setHospitals(hospitals.map(h => {
                if (h.id === selectedHospitalId) {
                    const materials = h.accreditationMaterials ? [...h.accreditationMaterials] : [];
                    materials.push(materialMetadata);
                    return { ...h, accreditationMaterials: materials };
                }
                return h;
            }));
        } catch (error) {
            console.error("Failed to add accreditation material:", error);
            alert("Failed to save material to the database.");
        }
    };

    const handleDeleteAccreditationMaterial = async (materialId: string) => {
        if (!selectedHospitalId) return;
        try {
            await db.deleteMaterial(materialId);

            setHospitals(hospitals.map(h => {
                if (h.id === selectedHospitalId) {
                    const materials = (h.accreditationMaterials || []).filter(m => m.id !== materialId);
                    return { ...h, accreditationMaterials: materials };
                }
                return h;
            }));
        } catch (error) {
            console.error("Failed to delete accreditation material:", error);
            alert("Failed to delete material from the database.");
        }
    };

    const handleUpdateAccreditationMaterialDescription = (materialId: string, description: string) => {
        if (!selectedHospitalId) return;
        setHospitals(hospitals.map(h => {
            if (h.id === selectedHospitalId) {
                const materials = (h.accreditationMaterials || []).map(m => m.id === materialId ? { ...m, description } : m);
                return { ...h, accreditationMaterials: materials };
            }
            return h;
        }));
    };

    // --- News Banner Handlers ---
    const handleAddNewsBanner = async (banner: Omit<NewsBanner, 'id' | 'imageId'>, imageData: string) => {
        if (!selectedHospitalId) return;
        const imageId = `banner-img-${Date.now()}`;
        const newBanner: NewsBanner = {
            id: `banner-meta-${Date.now()}`,
            ...banner,
            imageId,
        };

        try {
            await db.addMaterial({ id: imageId, data: imageData });
            setHospitals(hospitals.map(h => {
                if (h.id === selectedHospitalId) {
                    const banners = h.newsBanners ? [...h.newsBanners, newBanner] : [newBanner];
                    return { ...h, newsBanners: banners };
                }
                return h;
            }));
        } catch (error) {
            console.error("Failed to add news banner:", error);
            alert("Failed to save banner image to the database.");
        }
    };

    const handleDeleteNewsBanner = async (bannerId: string) => {
        if (!selectedHospitalId) return;
        let imageIdToDelete: string | null = null;

        const updatedHospitals = hospitals.map(h => {
            if (h.id === selectedHospitalId) {
                const banner = (h.newsBanners || []).find(b => b.id === bannerId);
                if (banner) {
                    imageIdToDelete = banner.imageId;
                }
                const banners = (h.newsBanners || []).filter(b => b.id !== bannerId);
                return { ...h, newsBanners: banners };
            }
            return h;
        });

        if (imageIdToDelete) {
            try {
                await db.deleteMaterial(imageIdToDelete);
                setHospitals(updatedHospitals);
            } catch (error) {
                console.error("Failed to delete banner image:", error);
                alert("Failed to delete banner image from the database.");
            }
        } else {
            setHospitals(updatedHospitals);
        }
    };

    const handleUpdateNewsBanner = (bannerId: string, title: string, description: string) => {
        if (!selectedHospitalId) return;

        setHospitals(hospitals.map(h => {
            if (h.id === selectedHospitalId) {
                const banners = (h.newsBanners || []).map(b =>
                    b.id === bannerId ? { ...b, title, description } : b
                );
                return { ...h, newsBanners: banners };
            }
            return h;
        }));
    };
    
    // --- Patient Education & Patient Handlers ---
    const handleAddPatient = (departmentId: string, name: string, nationalId: string, password?: string) => {
        const newPatient: Patient = { id: Date.now().toString(), name, nationalId, password, chatHistory: [] };
        setHospitals(hospitals.map(h => {
            if (h.id === selectedHospitalId) {
                return {
                    ...h, departments: h.departments.map(d => {
                        if (d.id === departmentId) {
                            const patients = d.patients ? [...d.patients, newPatient] : [newPatient];
                            return { ...d, patients };
                        }
                        return d;
                    })
                };
            }
            return h;
        }));
    };
    
    const handleDeletePatient = (departmentId: string, patientId: string) => {
        setHospitals(hospitals.map(h => {
            if (h.id === selectedHospitalId) {
                return {
                    ...h, departments: h.departments.map(d => {
                        if (d.id === departmentId) {
                            const patients = (d.patients || []).filter(p => p.id !== patientId);
                            return { ...d, patients };
                        }
                        return d;
                    })
                };
            }
            return h;
        }));
    };

    const handleSendPatientChatMessage = (departmentId: string, patientId: string, content: MessageContent, sender: 'patient' | 'manager') => {
        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            sender,
            timestamp: new Date().toISOString(),
            ...content
        };
        setHospitals(hospitals.map(h => {
            if (h.id === selectedHospitalId) {
                return {
                    ...h,
                    departments: h.departments.map(d => {
                        if (d.id === departmentId) {
                            return {
                                ...d,
                                patients: (d.patients || []).map(p => {
                                    if (p.id === patientId) {
                                        const chatHistory = p.chatHistory ? [...p.chatHistory, newMessage] : [newMessage];
                                        return { ...p, chatHistory };
                                    }
                                    return p;
                                })
                            };
                        }
                        return d;
                    })
                };
            }
            return h;
        }));
    };

    const handleAddPatientEducationMaterial = async (material: TrainingMaterial) => {
        if (!material.data || !selectedHospitalId || !selectedDepartmentId) {
            alert("Error: Material data, hospital, or department is missing.");
            return;
        }

        try {
            await db.addMaterial({ id: material.id, data: material.data });

            const materialMetadata: TrainingMaterial = { ...material };
            delete materialMetadata.data;

            setHospitals(hospitals.map(h => {
                if (h.id === selectedHospitalId) {
                    return {
                        ...h,
                        departments: h.departments.map(d => {
                            if (d.id === selectedDepartmentId) {
                                const materials = d.patientEducationMaterials ? [...d.patientEducationMaterials, materialMetadata] : [materialMetadata];
                                return { ...d, patientEducationMaterials: materials };
                            }
                            return d;
                        })
                    };
                }
                return h;
            }));
        } catch (error) {
            console.error("Failed to add patient education material:", error);
            alert("Failed to save material to the database.");
        }
    };

    const handleDeletePatientEducationMaterial = async (materialId: string) => {
        if (!selectedHospitalId || !selectedDepartmentId) return;
        try {
            await db.deleteMaterial(materialId);

            setHospitals(hospitals.map(h => {
                if (h.id === selectedHospitalId) {
                    return {
                        ...h,
                        departments: h.departments.map(d => {
                            if (d.id === selectedDepartmentId) {
                                const materials = (d.patientEducationMaterials || []).filter(m => m.id !== materialId);
                                return { ...d, patientEducationMaterials: materials };
                            }
                            return d;
                        })
                    };
                }
                return h;
            }));
        } catch (error) {
            console.error("Failed to delete patient education material:", error);
            alert("Failed to delete material from the database.");
        }
    };
    
    const handleUpdatePatientEducationMaterialDescription = (materialId: string, description: string) => {
        if (!selectedHospitalId || !selectedDepartmentId) return;
        setHospitals(hospitals.map(h => {
            if (h.id === selectedHospitalId) {
                return {
                    ...h,
                    departments: h.departments.map(d => {
                        if (d.id === selectedDepartmentId) {
                             const materials = (d.patientEducationMaterials || []).map(m => m.id === materialId ? { ...m, description } : m);
                             return { ...d, patientEducationMaterials: materials };
                        }
                        return d;
                    })
                };
            }
            return h;
        }));
    };
    
  // --- Communication Handlers ---
  const handleSendMessage = (hospitalId: string, content: MessageContent, sender: 'hospital' | 'admin') => {
    const newMessage: AdminMessage = {
        id: Date.now().toString(),
        sender,
        timestamp: new Date().toISOString(),
        ...content
    };
    setHospitals(hospitals.map(h => {
        if (h.id === hospitalId) {
            const messages = h.adminMessages ? [...h.adminMessages, newMessage] : [newMessage];
            return { ...h, adminMessages: messages };
        }
        return h;
    }));
  };

  // --- Auth Handlers ---
  const handleLogin = (nationalId: string, password: string) => {
    setLoginError(null);
    if (!nationalId || !password) {
        setLoginError('کد ملی و رمز عبور الزامی است.');
        return;
    }

    // Admin Login
    if (nationalId === "5850008985" && password === "64546") {
      setLoggedInUser({ role: UserRole.Admin, name: 'ادمین کل' });
      setIsLoginModalOpen(false);
      if (appScreen === AppScreen.Welcome) {
        setAppScreen(AppScreen.HospitalList);
      }
      return;
    }

    // Supervisor, Manager, or Staff Login
    for(const hospital of hospitals) {
        // Supervisor
        if (hospital.supervisorNationalId === nationalId && hospital.supervisorPassword === password) {
            setLoggedInUser({ role: UserRole.Supervisor, name: hospital.supervisorName || 'سوپروایزر', hospitalId: hospital.id });
            handleSelectHospital(hospital.id);
            setIsLoginModalOpen(false);
            return;
        }
        for(const department of hospital.departments) {
            // Manager
            if (department.managerNationalId === nationalId && department.managerPassword === password) {
                setLoggedInUser({ role: UserRole.Manager, name: department.managerName, hospitalId: hospital.id, departmentId: department.id });
                handleSelectHospital(hospital.id);
                handleSelectDepartment(department.id);
                setIsLoginModalOpen(false);
                return;
            }
            // Staff
            for (const staff of department.staff) {
                if (staff.nationalId === nationalId && staff.password === password) {
                    setLoggedInUser({ role: UserRole.Staff, name: staff.name, hospitalId: hospital.id, departmentId: department.id, staffId: staff.id });
                    handleSelectHospital(hospital.id);
                    handleSelectDepartment(department.id);
                    handleSelectStaff(staff.id);
                    setIsLoginModalOpen(false);
                    return;
                }
            }
            // Patient
            for (const patient of department.patients || []) {
                if (patient.nationalId === nationalId && patient.password === password) {
                    setLoggedInUser({ role: UserRole.Patient, name: patient.name, hospitalId: hospital.id, departmentId: department.id, patientId: patient.id });
                    setAppScreen(AppScreen.MainApp);
                    setCurrentView(View.PatientPortal);
                    setIsLoginModalOpen(false);
                    return;
                }
            }
        }
    }
    setLoginError('کد ملی یا رمز عبور نامعتبر است.');
  }

  const handleLogout = () => {
    setLoggedInUser(null);
    setSelectedHospitalId(null);
    setSelectedDepartmentId(null);
    setSelectedStaffId(null);
    setCurrentView(View.DepartmentList);
    setAppScreen(AppScreen.Welcome);
  }

  // --- Render Logic ---
  const getScope = (): { scope: 'department' | 'hospital' | 'all', name?: string } => {
    const hospital = findHospital(selectedHospitalId);
    const department = findDepartment(hospital, selectedDepartmentId);

    if (department && hospital && (currentView === View.DepartmentView || currentView === View.StaffMemberView || currentView === View.PatientEducationManager)) {
        return { scope: 'department', name: department.name };
    }
    if (hospital && (currentView === View.DepartmentList || currentView === View.ChecklistManager || currentView === View.ExamManager || currentView === View.TrainingManager || currentView === View.AccreditationManager || currentView === View.NewsBannerManager || currentView === View.HospitalCommunication)) {
        return { scope: 'hospital', name: hospital.name };
    }
    return { scope: 'all' };
  };

  const getSaveLoadLabels = () => {
    const scopeInfo = getScope();
    switch (scopeInfo.scope) {
        case 'department':
            return { save: 'ذخیره بخش', load: 'بارگذاری بخش' };
        case 'hospital':
            return { save: 'ذخیره بیمارستان', load: 'بارگذاری بیمارستان' };
        case 'all':
        default:
            return { save: 'ذخیره کل', load: 'بارگذاری کل' };
    }
  };

  const renderContent = () => {
    // Non-admin users are locked to their scope
    if (loggedInUser && loggedInUser.role !== UserRole.Admin) {
        const hospital = findHospital(loggedInUser.hospitalId!);
        if (!hospital) return <p>Error: Hospital not found for user.</p>;

        if (loggedInUser.role === UserRole.Patient) {
            const department = findDepartment(hospital, loggedInUser.departmentId!);
            const patient = department?.patients?.find(p => p.id === loggedInUser.patientId);
            if (!department || !patient) return <p>Error: Patient data not found.</p>;
            return <PatientPortalView
                        department={department}
                        patient={patient}
                        onSendMessage={(content) => handleSendPatientChatMessage(department.id, patient.id, content, 'patient')}
                    />
        }
        
        if (loggedInUser.role === UserRole.Staff) {
            const department = findDepartment(hospital, loggedInUser.departmentId!);
            const staffMember = findStaffMember(department, loggedInUser.staffId!);
            if (!department || !staffMember) return <p>Error: Staff member not found.</p>;
            return <StaffMemberView
                        department={department}
                        staffMember={staffMember}
                        onBack={() => {}} // Staff cannot go back
                        onAddOrUpdateAssessment={handleAddOrUpdateAssessment}
                        onUpdateAssessmentMessages={handleUpdateAssessmentMessages}
                        onSubmitExam={handleSubmitExam}
                        checklistTemplates={hospital.checklistTemplates || []}
                        examTemplates={hospital.examTemplates || []}
                        trainingMaterials={hospital.trainingMaterials || []}
                        accreditationMaterials={hospital.accreditationMaterials || []}
                        newsBanners={hospital.newsBanners || []}
                        userRole={loggedInUser.role}
                   />
        }

        if (loggedInUser.role === UserRole.Manager) {
            const department = findDepartment(hospital, loggedInUser.departmentId!);
            if (!department) return <p>Error: Department not found for manager.</p>;

            if (currentView === View.StaffMemberView) {
                const staffMember = findStaffMember(department, selectedStaffId);
                if (!staffMember) return <p>Selected staff member not found.</p>;

                return <StaffMemberView
                        department={department}
                        staffMember={staffMember}
                        onBack={handleBack}
                        onAddOrUpdateAssessment={handleAddOrUpdateAssessment}
                        onUpdateAssessmentMessages={handleUpdateAssessmentMessages}
                        onSubmitExam={handleSubmitExam}
                        checklistTemplates={hospital.checklistTemplates || []}
                        examTemplates={hospital.examTemplates || []}
                        trainingMaterials={hospital.trainingMaterials || []}
                        accreditationMaterials={hospital.accreditationMaterials || []}
                        newsBanners={hospital.newsBanners || []}
                        userRole={loggedInUser.role}
                   />
            }
            if (currentView === View.PatientEducationManager) {
                return <PatientEducationManager
                    department={department}
                    onAddMaterial={handleAddPatientEducationMaterial}
                    onDeleteMaterial={handleDeletePatientEducationMaterial}
                    onUpdateMaterialDescription={handleUpdatePatientEducationMaterialDescription}
                    onBack={handleBack}
                    onAddPatient={(name, nationalId, password) => handleAddPatient(department.id, name, nationalId, password)}
                    onDeletePatient={(patientId) => handleDeletePatient(department.id, patientId)}
                    onSendMessage={(patientId, content, sender) => handleSendPatientChatMessage(department.id, patientId, content, sender)}
                />;
            }

            return <DepartmentView
                        department={department}
                        onBack={() => {}} // Manager cannot go back from their department
                        onAddStaff={handleAddStaff}
                        onUpdateStaff={handleUpdateStaff}
                        onDeleteStaff={handleDeleteStaff}
                        onSelectStaff={handleSelectStaff}
                        onComprehensiveImport={handleComprehensiveImport}
                        onManageChecklists={() => setCurrentView(View.ChecklistManager)}
                        onManageExams={() => setCurrentView(View.ExamManager)}
                        onManageTraining={() => setCurrentView(View.TrainingManager)}
                        onManagePatientEducation={() => setCurrentView(View.PatientEducationManager)}
                        onAddOrUpdateWorkLog={handleAddOrUpdateWorkLog}
                        userRole={loggedInUser.role}
                        newsBanners={hospital.newsBanners || []}
                    />
        }

        // Supervisor role
        if (loggedInUser.role === UserRole.Supervisor) {
            const department = findDepartment(hospital, selectedDepartmentId);
            const staffMember = findStaffMember(department, selectedStaffId);
    
            switch (currentView) {
                case View.DepartmentView:
                  if (!department) return <p>Selected department not found.</p>;
                  return <DepartmentView department={department} onBack={handleBack} onAddStaff={handleAddStaff} onUpdateStaff={handleUpdateStaff} onDeleteStaff={handleDeleteStaff} onSelectStaff={handleSelectStaff} onComprehensiveImport={handleComprehensiveImport} onManageChecklists={() => setCurrentView(View.ChecklistManager)} onManageExams={() => setCurrentView(View.ExamManager)} onManageTraining={() => setCurrentView(View.TrainingManager)} onManagePatientEducation={() => setCurrentView(View.PatientEducationManager)} onAddOrUpdateWorkLog={handleAddOrUpdateWorkLog} userRole={loggedInUser.role} newsBanners={hospital.newsBanners || []} />;
                case View.StaffMemberView:
                  if (!department || !staffMember) return <p>Selected staff member not found.</p>;
                  return <StaffMemberView department={department} staffMember={staffMember} onBack={handleBack} onAddOrUpdateAssessment={handleAddOrUpdateAssessment} onUpdateAssessmentMessages={handleUpdateAssessmentMessages} onSubmitExam={handleSubmitExam} checklistTemplates={hospital.checklistTemplates || []} examTemplates={hospital.examTemplates || []} trainingMaterials={hospital.trainingMaterials || []} accreditationMaterials={hospital.accreditationMaterials || []} newsBanners={hospital.newsBanners || []} userRole={loggedInUser.role} />;
                case View.ChecklistManager:
                    return <ChecklistManager templates={hospital.checklistTemplates || []} onAddOrUpdate={handleAddOrUpdateChecklistTemplate} onDelete={handleDeleteChecklistTemplate} onBack={handleBack} />;
                case View.ExamManager:
                    return <ExamManager templates={hospital.examTemplates || []} onAddOrUpdate={handleAddOrUpdateExamTemplate} onDelete={handleDeleteExamTemplate} onBack={handleBack} />;
                case View.TrainingManager:
                    return <TrainingManager monthlyTrainings={hospital.trainingMaterials || []} onAddMaterial={handleAddTrainingMaterial} onDeleteMaterial={handleDeleteTrainingMaterial} onUpdateMaterialDescription={handleUpdateMaterialDescription} onBack={handleBack} />
                case View.AccreditationManager:
                    return <AccreditationManager materials={hospital.accreditationMaterials || []} onAddMaterial={handleAddAccreditationMaterial} onDeleteMaterial={handleDeleteAccreditationMaterial} onUpdateMaterialDescription={handleUpdateAccreditationMaterialDescription} onBack={handleBack} />
                case View.NewsBannerManager:
                    return <NewsBannerManager banners={hospital.newsBanners || []} onAddBanner={handleAddNewsBanner} onUpdateBanner={handleUpdateNewsBanner} onDeleteBanner={handleDeleteNewsBanner} onBack={handleBack} />;
                case View.PatientEducationManager:
                     if (!department) return <p>Selected department not found.</p>;
                     return <PatientEducationManager 
                        department={department} 
                        onAddMaterial={handleAddPatientEducationMaterial} 
                        onDeleteMaterial={handleDeletePatientEducationMaterial} 
                        onUpdateMaterialDescription={handleUpdatePatientEducationMaterialDescription} 
                        onBack={handleBack} 
                        onAddPatient={(name, nationalId, password) => handleAddPatient(department.id, name, nationalId, password)}
                        onDeletePatient={(patientId) => handleDeletePatient(department.id, patientId)}
                        onSendMessage={(patientId, content, sender) => handleSendPatientChatMessage(department.id, patientId, content, sender)}
                     />;
                case View.HospitalCommunication:
                     return <HospitalCommunicationView hospital={hospital} onSendMessage={(content) => handleSendMessage(hospital.id, content, 'hospital')} onBack={handleBack} />;
                case View.DepartmentList:
                default:
                  return <DepartmentList
                    departments={hospital.departments}
                    hospitalName={hospital.name}
                    onAddDepartment={handleAddDepartment}
                    onUpdateDepartment={handleUpdateDepartment}
                    onDeleteDepartment={handleDeleteDepartment}
                    onSelectDepartment={handleSelectDepartment}
                    onBack={() => {}} // Supervisor in DepartmentList for their hospital doesn't go back further
                    onManageAccreditation={() => setCurrentView(View.AccreditationManager)}
                    onManageNewsBanners={() => setCurrentView(View.NewsBannerManager)}
                    onResetHospital={handleResetHospital}
                    onContactAdmin={() => setCurrentView(View.HospitalCommunication)}
                    userRole={loggedInUser.role}
                  />;
            }
        }
    }

    // Admin user flow
    if (appScreen === AppScreen.HospitalList || !selectedHospitalId) {
        if (currentView === View.AdminCommunication) {
            return <AdminCommunicationView hospitals={hospitals} onSendMessage={(hospitalId, content) => handleSendMessage(hospitalId, content, 'admin')} onBack={() => setCurrentView(View.DepartmentList)} />;
        }
        return <HospitalList hospitals={hospitals} onAddHospital={handleAddHospital} onUpdateHospital={handleUpdateHospital} onDeleteHospital={handleDeleteHospital} onSelectHospital={handleSelectHospital} onGoToWelcome={handleGoToWelcome} userRole={loggedInUser?.role ?? UserRole.Admin} onContactAdmin={() => setCurrentView(View.AdminCommunication)} />;
    }

    const hospital = findHospital(selectedHospitalId);
    if (!hospital) return <p>Selected hospital not found.</p>;
    const department = findDepartment(hospital, selectedDepartmentId);
    const staffMember = findStaffMember(department, selectedStaffId);

    switch (currentView) {
      case View.DepartmentView:
        if (!department) return <p>Selected department not found.</p>;
        return <DepartmentView department={department} onBack={handleBack} onAddStaff={handleAddStaff} onUpdateStaff={handleUpdateStaff} onDeleteStaff={handleDeleteStaff} onSelectStaff={handleSelectStaff} onComprehensiveImport={handleComprehensiveImport} onManageChecklists={() => setCurrentView(View.ChecklistManager)} onManageExams={() => setCurrentView(View.ExamManager)} onManageTraining={() => setCurrentView(View.TrainingManager)} onManagePatientEducation={() => setCurrentView(View.PatientEducationManager)} onAddOrUpdateWorkLog={handleAddOrUpdateWorkLog} userRole={loggedInUser?.role ?? UserRole.Admin} newsBanners={hospital.newsBanners || []} />;
      case View.StaffMemberView:
        if (!department || !staffMember) return <p>Selected staff member not found.</p>;
        return <StaffMemberView department={department} staffMember={staffMember} onBack={handleBack} onAddOrUpdateAssessment={handleAddOrUpdateAssessment} onUpdateAssessmentMessages={handleUpdateAssessmentMessages} onSubmitExam={handleSubmitExam} checklistTemplates={hospital.checklistTemplates || []} examTemplates={hospital.examTemplates || []} trainingMaterials={hospital.trainingMaterials || []} accreditationMaterials={hospital.accreditationMaterials || []} newsBanners={hospital.newsBanners || []} userRole={loggedInUser?.role ?? UserRole.Admin} />;
      case View.ChecklistManager:
        return <ChecklistManager templates={hospital.checklistTemplates || []} onAddOrUpdate={handleAddOrUpdateChecklistTemplate} onDelete={handleDeleteChecklistTemplate} onBack={handleBack} />;
      case View.ExamManager:
        return <ExamManager templates={hospital.examTemplates || []} onAddOrUpdate={handleAddOrUpdateExamTemplate} onDelete={handleDeleteExamTemplate} onBack={handleBack} />;
      case View.TrainingManager:
        return <TrainingManager monthlyTrainings={hospital.trainingMaterials || []} onAddMaterial={handleAddTrainingMaterial} onDeleteMaterial={handleDeleteTrainingMaterial} onUpdateMaterialDescription={handleUpdateMaterialDescription} onBack={handleBack} />
      case View.AccreditationManager:
        return <AccreditationManager materials={hospital.accreditationMaterials || []} onAddMaterial={handleAddAccreditationMaterial} onDeleteMaterial={handleDeleteAccreditationMaterial} onUpdateMaterialDescription={handleUpdateAccreditationMaterialDescription} onBack={handleBack} />
      case View.NewsBannerManager:
        return <NewsBannerManager banners={hospital.newsBanners || []} onAddBanner={handleAddNewsBanner} onUpdateBanner={handleUpdateNewsBanner} onDeleteBanner={handleDeleteNewsBanner} onBack={handleBack} />;
      case View.PatientEducationManager:
        if (!department) return <p>Selected department not found.</p>;
        return <PatientEducationManager 
            department={department} 
            onAddMaterial={handleAddPatientEducationMaterial} 
            onDeleteMaterial={handleDeletePatientEducationMaterial} 
            onUpdateMaterialDescription={handleUpdatePatientEducationMaterialDescription} 
            onBack={handleBack} 
            onAddPatient={(name, nationalId, password) => handleAddPatient(department.id, name, nationalId, password)}
            onDeletePatient={(patientId) => handleDeletePatient(department.id, patientId)}
            onSendMessage={(patientId, content, sender) => handleSendPatientChatMessage(department.id, patientId, content, sender)}
        />;
      case View.HospitalCommunication:
        return <HospitalCommunicationView hospital={hospital} onSendMessage={(content) => handleSendMessage(hospital.id, content, 'hospital')} onBack={handleBack} />;
      case View.DepartmentList:
      default:
        return <DepartmentList
          departments={hospital.departments}
          hospitalName={hospital.name}
          onAddDepartment={handleAddDepartment}
          onUpdateDepartment={handleUpdateDepartment}
          onDeleteDepartment={handleDeleteDepartment}
          onSelectDepartment={handleSelectDepartment}
          onBack={handleBack}
          onManageAccreditation={() => setCurrentView(View.AccreditationManager)}
          onManageNewsBanners={() => setCurrentView(View.NewsBannerManager)}
          onResetHospital={handleResetHospital}
          onContactAdmin={() => setCurrentView(View.HospitalCommunication)}
          userRole={loggedInUser?.role ?? UserRole.Admin}
        />;
    }
  };
  
  const showSaveLoad = loggedInUser && (appScreen === AppScreen.HospitalList || currentView === View.DepartmentList || currentView === View.DepartmentView);

  const showHeaderBackButton = loggedInUser && appScreen === AppScreen.MainApp &&
    !(currentView === View.DepartmentList && (loggedInUser.role === UserRole.Supervisor || loggedInUser.role === UserRole.Manager)) &&
    !(currentView === View.StaffMemberView && loggedInUser.role === UserRole.Staff) &&
    !(currentView === View.PatientPortal && loggedInUser.role === UserRole.Patient);

  const { save: saveLabel, load: loadLabel } = getSaveLoadLabels();
  
  const renderApp = () => {
    if (appScreen === AppScreen.Welcome) {
      return <WelcomeScreen onEnter={() => setIsLoginModalOpen(true)} />;
    }

    return (
      <div className="bg-slate-100 dark:bg-slate-900 min-h-screen flex flex-col">
        <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 shadow-md flex justify-between items-center">
          <div className="flex items-center gap-4">
              {showHeaderBackButton && (
                <button onClick={handleBack} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors">
                    <BackIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">بازگشت</span>
                </button>
            )}
            <h1 className="text-2xl font-bold flex items-center gap-2">
              سامانه بیمارستان من
              {loggedInUser && loggedInUser.role !== UserRole.Admin && (
                <span className="text-sm font-normal mr-2">
                  ({loggedInUser.role === UserRole.Supervisor ? 'سوپروایزر' : loggedInUser.role === UserRole.Manager ? 'مدیر بخش' : loggedInUser.role === UserRole.Staff ? 'پرسنل' : 'بیمار'})
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
              {loggedInUser && (
                  <span className="text-sm font-medium hidden sm:block">
                      خوش آمدید، {loggedInUser.name}
                      {getScope().name && ` (${getScope().name})`}
                  </span>
              )}

              {showSaveLoad && (
                  <>
                      <button onClick={handleSaveData} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors">
                          <SaveIcon className="w-5 h-5" />
                          <span className="hidden sm:inline">{saveLabel}</span>
                      </button>
                      <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md text-white bg-cyan-500 hover:bg-cyan-600 transition-colors">
                          <UploadIcon className="w-5 h-5" />
                          <span className="hidden sm:inline">{loadLabel}</span>
                      </label>
                      <input id="file-upload" type="file" accept=".json" onChange={handleLoadData} className="hidden" />
                  </>
              )}

              <div className="w-px h-6 bg-white/30 mx-1"></div>

              <button onClick={() => setIsAboutModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md text-white bg-yellow-500 hover:bg-yellow-600 transition-colors" title="درباره برنامه">
                  <InfoIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">درباره</span>
              </button>

              {loggedInUser ? (
                  <button onClick={handleLogout} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors" title="خروج">
                      <LogoutIcon className="w-5 h-5" />
                      <span className="hidden sm:inline">خروج</span>
                  </button>
              ) : (
                  <button onClick={() => setIsLoginModalOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors" title="ورود">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
                      <span className="hidden sm:inline">ورود</span>
                  </button>
              )}
          </div>
        </header>
        
        <main className="flex-grow p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>
    );
  };


  return (
    <>
      {renderApp()}
      <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLogin} loginError={loginError} />
    </>
  );
};

export default App;