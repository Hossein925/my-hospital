import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Department, StaffMember, SkillCategory, Assessment, NamedChecklistTemplate, ExamTemplate, Question, QuestionType, ExamSubmission, ExamAnswer, UserRole, MonthlyTraining, TrainingMaterial, NewsBanner } from '../types';
import { generateImprovementPlan } from '../services/geminiService';
import SkillCategoryDisplay from './SkillCategoryDisplay';
import SuggestionModal from './SuggestionModal';
import Modal from './Modal';
import { BackIcon } from './icons/BackIcon';
import { AiIcon } from './icons/AiIcon';
import { SaveIcon } from './icons/SaveIcon';
import { EditIcon } from './icons/EditIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { ClipboardDocumentCheckIcon } from './icons/ClipboardDocumentCheckIcon';
import { AcademicCapIcon } from './icons/AcademicCapIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import PreviewModal from './PreviewModal';
import { ImageIcon } from './icons/ImageIcon';
import { VideoIcon } from './icons/VideoIcon';
import { AudioIcon } from './icons/AudioIcon';
import { PdfIcon } from './icons/PdfIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import NewsCarousel from './NewsCarousel';

interface StaffMemberViewProps {
  department: Department;
  staffMember: StaffMember;
  onBack: () => void;
  onAddOrUpdateAssessment: (departmentId: string, staffId: string, month: string, skills: SkillCategory[], template?: NamedChecklistTemplate) => void;
  onUpdateAssessmentMessages: (departmentId: string, staffId: string, month: string, messages: { supervisorMessage: string; managerMessage: string; }) => void;
  onSubmitExam: (departmentId: string, staffId: string, month: string, submission: ExamSubmission) => void;
  checklistTemplates: NamedChecklistTemplate[];
  examTemplates: ExamTemplate[];
  trainingMaterials: MonthlyTraining[];
  accreditationMaterials: TrainingMaterial[];
  newsBanners: NewsBanner[];
  userRole: UserRole;
}

const PERSIAN_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد",
  "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر",
  "دی", "بهمن", "اسفند"
];

const CHART_COLORS = ['#3b82f6', '#16a34a', '#f97316', '#dc2626', '#8b5cf6', '#db2777'];

type ViewMode = 'month_selection' | 'assessment_form' | 'assessment_result';
type AssessmentResultView = 'details' | 'summary' | 'exam_list' | 'exam_taking' | 'exam_result' | 'training_materials' | 'accreditation_materials';

const getIconForMimeType = (type: string): { icon: React.ReactNode, color: string } => {
    if (type.startsWith('image/')) return { icon: <ImageIcon className="w-10 h-10" />, color: 'text-blue-500' };
    if (type.startsWith('video/')) return { icon: <VideoIcon className="w-10 h-10" />, color: 'text-red-500' };
    if (type.startsWith('audio/')) return { icon: <AudioIcon className="w-10 h-10" />, color: 'text-purple-500' };
    if (type === 'application/pdf') return { icon: <PdfIcon className="w-10 h-10" />, color: 'text-orange-500' };
    return { icon: <DocumentIcon className="w-10 h-10" />, color: 'text-slate-500' };
};

const StaffMemberView: React.FC<StaffMemberViewProps> = ({
  department,
  staffMember,
  onBack,
  onAddOrUpdateAssessment,
  onUpdateAssessmentMessages,
  onSubmitExam,
  checklistTemplates,
  examTemplates,
  trainingMaterials,
  accreditationMaterials,
  newsBanners,
  userRole,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [suggestionContent, setSuggestionContent] = useState<string | null>(null);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [supervisorMessage, setSupervisorMessage] = useState('');
  const [managerMessage, setManagerMessage] = useState('');
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('month_selection');
  const [assessmentSubView, setAssessmentSubView] = useState<AssessmentResultView>('details');
  const [assessmentFormData, setAssessmentFormData] = useState<SkillCategory[]>([]);
  const [activeAssessmentTemplate, setActiveAssessmentTemplate] = useState<NamedChecklistTemplate | null>(null);

  // Exam state
  const [currentExam, setCurrentExam] = useState<ExamTemplate | null>(null);
  const [examAnswers, setExamAnswers] = useState<Map<string, string>>(new Map());
  const [currentSubmissionResult, setCurrentSubmissionResult] = useState<ExamSubmission | null>(null);
  
  // Preview State
  const [previewMaterial, setPreviewMaterial] = useState<TrainingMaterial | null>(null);


  const assessmentsByMonth = useMemo(() => {
    const map = new Map<string, Assessment>();
    staffMember.assessments.forEach(a => map.set(a.month, a));
    return map;
  }, [staffMember.assessments]);


  const handleGetComprehensiveSuggestions = () => {
    if (!selectedMonth) return;
    const assessment = assessmentsByMonth.get(selectedMonth);
    if (!assessment) return;
    const maxScore = assessment.maxScore ?? 4;

    const weakSkillsByCateogry = assessment.skillCategories
      .map(cat => ({
        categoryName: cat.name,
        skills: cat.items.filter(item => item.score < maxScore)
      }))
      .filter(cat => cat.skills.length > 0);
    
    if (weakSkillsByCateogry.length === 0) {
        alert("این پرسنل در تمام مهارت‌ها نمره کامل کسب کرده است.");
        return;
    }

    setIsSuggestionModalOpen(true);
    setIsSuggestionLoading(true);
    setSuggestionContent(null);

    setTimeout(() => {
        const result = generateImprovementPlan(
          staffMember, 
          weakSkillsByCateogry,
          assessment.supervisorMessage,
          assessment.managerMessage
        );
        setSuggestionContent(result);
        setIsSuggestionLoading(false);
    }, 50);
};

  const hasWeakSkillsInSelectedMonth = useMemo(() => {
    if (!selectedMonth) return false;
    const assessment = assessmentsByMonth.get(selectedMonth);
    if (!assessment) return false;
    const maxScore = assessment.maxScore ?? 4;
    return assessment.skillCategories.some(cat => cat.items.some(item => item.score < maxScore));
  }, [selectedMonth, assessmentsByMonth]);

  const progressChartInfo = useMemo(() => {
    const allCategoryNames = new Set<string>();
    staffMember.assessments.forEach(ass => ass.skillCategories.forEach(cat => allCategoryNames.add(cat.name)));
    const categoryNames = Array.from(allCategoryNames);

    const data = staffMember.assessments
      .filter(assessment => PERSIAN_MONTHS.includes(assessment.month))
      .map(assessment => {
      const scores: { [key: string]: any } = { name: assessment.month };
      const maxPossibleScore = assessment.maxScore ?? 4;
      
      assessment.skillCategories.forEach(cat => {
          const totalScore = cat.items.reduce((sum, item) => sum + item.score, 0);
          const maxScore = cat.items.length * maxPossibleScore;
          scores[cat.name] = maxScore > 0 ? parseFloat(((totalScore / maxScore) * 100).toFixed(1)) : null;
      });

      // Ensure all categories are present for this month, even if with a null score
      categoryNames.forEach(name => {
          if (!(name in scores)) {
              scores[name] = null;
          }
      });

      return scores;
    }).sort((a, b) => PERSIAN_MONTHS.indexOf(a.name as string) - PERSIAN_MONTHS.indexOf(b.name as string));
    
    return { data, categoryNames };
  }, [staffMember.assessments]);

  const handleSaveMessages = () => {
    if (!selectedMonth) return;
    onUpdateAssessmentMessages(department.id, staffMember.id, selectedMonth, {
        supervisorMessage,
        managerMessage
    });
    alert('پیام ها با موفقیت ذخیره شدند.');
  };
  
  const handleMonthSelect = (month: string) => {
    setSelectedMonth(month);
    const assessment = assessmentsByMonth.get(month);

    // Allow staff to view the result page even without an assessment,
    // to access the training materials archive.
    if (userRole === UserRole.Staff) {
        setViewMode('assessment_result');
        setAssessmentSubView('summary');
        setSupervisorMessage(assessment?.supervisorMessage || '');
        setManagerMessage(assessment?.managerMessage || '');
        return;
    }

    // For other roles (Admin, Supervisor, Manager)
    if (assessment) {
        setViewMode('assessment_result');
        setAssessmentSubView('details');
        setSupervisorMessage(assessment.supervisorMessage || '');
        setManagerMessage(assessment.managerMessage || '');
    } else {
        // No assessment exists, prompt to create one.
        if (!checklistTemplates || checklistTemplates.length === 0) {
            alert("هیچ قالب چک لیستی برای این بیمارستان تعریف نشده است. لطفا ابتدا از صفحه بخش‌ها، یک قالب چک لیست بسازید.");
            setSelectedMonth(null);
            return;
        }
        setIsChecklistModalOpen(true);
    }
  };

  const handleStartAssessmentWithTemplate = (template: NamedChecklistTemplate) => {
    const newCategoriesFromTemplate: SkillCategory[] = template.categories.map(catTemplate => ({
        name: catTemplate.name,
        items: catTemplate.items.map(itemTemplate => ({
            description: itemTemplate.description,
            score: template.minScore ?? 0,
        })),
    }));
    setAssessmentFormData(newCategoriesFromTemplate);
    setActiveAssessmentTemplate(template);
    setIsChecklistModalOpen(false);
    setViewMode('assessment_form');
  };

  const handleSaveAssessment = () => {
    if(!selectedMonth) return;
    onAddOrUpdateAssessment(department.id, staffMember.id, selectedMonth, assessmentFormData, activeAssessmentTemplate || undefined);
    setViewMode('assessment_result');
    setAssessmentSubView('details');
  };

  const handleEditAssessment = () => {
    if (!selectedMonth) return;
    const assessment = assessmentsByMonth.get(selectedMonth);
    if (!assessment) return;

    // Reconstruct a temporary template to hold the scoring rules for the form
    const templateForEditing: NamedChecklistTemplate = {
        id: assessment.templateId || 'imported-template',
        name: 'Editing Assessment',
        categories: [], // Not needed for the form logic
        minScore: assessment.minScore ?? 0,
        maxScore: assessment.maxScore ?? 4,
    };
    setActiveAssessmentTemplate(templateForEditing);

    const categoriesToEdit = JSON.parse(JSON.stringify(assessment.skillCategories));
    
    setAssessmentFormData(categoriesToEdit);
    setViewMode('assessment_form');
  };

  const handleScoreChange = (catIndex: number, itemIndex: number, score: number) => {
    const newCategories = [...assessmentFormData];
    const category = { ...newCategories[catIndex] };
    const items = [...category.items];
    const min = activeAssessmentTemplate?.minScore ?? 0;
    const max = activeAssessmentTemplate?.maxScore ?? 4;
    const finalScore = Math.max(min, Math.min(max, isNaN(score) ? 0 : score));
    items[itemIndex] = { ...items[itemIndex], score: finalScore };
    category.items = items;
    newCategories[catIndex] = category;
    setAssessmentFormData(newCategories);
  };
  
  const handleStartExam = (exam: ExamTemplate) => {
    setCurrentExam(exam);
    setExamAnswers(new Map());
    setAssessmentSubView('exam_taking');
  };

  const handleExamAnswerChange = (questionId: string, answer: string) => {
    setExamAnswers(new Map(examAnswers.set(questionId, answer)));
  };

  const handleSubmitExamClick = () => {
    if (!currentExam) return;
    if (examAnswers.size !== currentExam.questions.length) {
      if(!window.confirm('شما به تمام سوالات پاسخ نداده‌اید. آیا مایل به ثبت آزمون هستید؟')) {
        return;
      }
    }

    const answers: ExamAnswer[] = Array.from(examAnswers.entries()).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));

    let score = 0;
    const correctableQuestions = currentExam.questions.filter(q => q.type === QuestionType.MultipleChoice);
    correctableQuestions.forEach(q => {
      const userAnswer = examAnswers.get(q.id);
      if (userAnswer === q.correctAnswer) {
        score++;
      }
    });
    
    const submission: ExamSubmission = {
      id: Date.now().toString(),
      examTemplateId: currentExam.id,
      examName: currentExam.name,
      answers,
      score,
      totalCorrectableQuestions: correctableQuestions.length,
      submissionDate: new Date().toISOString(),
      questions: currentExam.questions, // Snapshot
    };
    
    onSubmitExam(department.id, staffMember.id, selectedMonth!, submission);
    
    setCurrentSubmissionResult(submission);
    setCurrentExam(null);
    setAssessmentSubView('exam_result');
  };

  const handleInternalBack = () => {
    if (viewMode === 'assessment_form') {
        setViewMode('month_selection');
        setSelectedMonth(null);
        setActiveAssessmentTemplate(null);
        return;
    }

    if (viewMode === 'assessment_result') {
        switch (assessmentSubView) {
            case 'summary':
                if (userRole === UserRole.Staff) {
                    setViewMode('month_selection');
                    setSelectedMonth(null);
                } else {
                    setAssessmentSubView('details');
                }
                break;
            case 'exam_list':
            case 'training_materials':
            case 'accreditation_materials':
                setAssessmentSubView('summary');
                break;
            case 'exam_taking':
            case 'exam_result':
                setAssessmentSubView('exam_list');
                setCurrentExam(null);
                setCurrentSubmissionResult(null);
                break;
            case 'details':
            default:
                setViewMode('month_selection');
                setSelectedMonth(null);
                break;
        }
    }
  };

  const renderAssessmentForm = () => {
    const minScore = activeAssessmentTemplate?.minScore ?? 0;
    const maxScore = activeAssessmentTemplate?.maxScore ?? 4;

    return (
      <div>
        <div className="flex justify-between items-center mb-6 bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
          <h2 className="text-xl font-bold">
            ثبت ارزیابی ماه <span className="text-indigo-600 dark:text-indigo-400">{selectedMonth}</span>
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleSaveAssessment}
              className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              <SaveIcon className="w-5 h-5" />
              تایید و ذخیره نمرات
            </button>
          </div>
        </div>
        
        <div className="space-y-6">
          {assessmentFormData.map((category, catIndex) => (
            <div key={catIndex} className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">{category.name}</h3>
              <div className="space-y-4">
                {category.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <label className="md:col-span-2 text-slate-700 dark:text-slate-300" htmlFor={`score-${catIndex}-${itemIndex}`}>
                      {item.description}
                    </label>
                    <input
                      id={`score-${catIndex}-${itemIndex}`}
                      type="number"
                      value={item.score}
                      onChange={(e) => handleScoreChange(catIndex, itemIndex, parseFloat(e.target.value))}
                      min={minScore}
                      max={maxScore}
                      step="0.1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const renderAssessmentDetails = (assessment: Assessment) => {
    return (
      <div>
        <div className="flex justify-end items-start mb-6">
            <div className="flex items-center gap-2">
                {userRole !== UserRole.Staff && (
                  <button
                      onClick={handleEditAssessment}
                      className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                      <EditIcon className="w-5 h-5" />
                      ویرایش نمرات
                  </button>
                )}
                <button onClick={() => setAssessmentSubView('summary')} className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700">
                    <ChartBarIcon className="w-5 h-5" />
                    مشاهده نتایج و برنامه پیشنهادی
                </button>
            </div>
        </div>
        <h2 className="text-2xl font-bold mb-4">جزئیات ارزیابی در <span className="text-indigo-600 dark:text-indigo-400">{selectedMonth}</span></h2>
        {assessment.skillCategories.map((category) => (
          <SkillCategoryDisplay
            key={category.name}
            category={category}
            maxPossibleScore={assessment.maxScore}
          />
        ))}

        {userRole !== UserRole.Staff && (
            <div className="mt-8 bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold mb-4">پیام‌های مدیریتی</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">در این بخش می‌توانید بازخورد خود را برای این ارزیابی ثبت کنید. این پیام‌ها در برنامه بهبود پیشنهادی نیز نمایش داده خواهند شد.</p>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="supervisorMessage" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            پیام سوپروایزر آموزشی
                        </label>
                        <textarea
                            id="supervisorMessage"
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={supervisorMessage}
                            onChange={(e) => setSupervisorMessage(e.target.value)}
                            placeholder="یک متن چند خطی بنویسید..."
                        />
                    </div>
                    <div>
                        <label htmlFor="managerMessage" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            پیام مسئول بخش
                        </label>
                        <textarea
                            id="managerMessage"
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={managerMessage}
                            onChange={(e) => setManagerMessage(e.target.value)}
                            placeholder="یک متن چند خطی بنویسید..."
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={handleSaveMessages}
                            className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                            <SaveIcon className="w-5 h-5" />
                            ذخیره پیام ها
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  };

  const renderAssessmentSummary = () => {
    const assessmentExists = selectedMonth ? assessmentsByMonth.has(selectedMonth) : false;
    const workLog = staffMember.workLogs?.find(log => log.month === selectedMonth);

    return (
      <div>
        {workLog && (
            <div className="mb-8 bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">گزارش کارکرد ماهانه</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">موظفی ماه</p>
                        <p className="text-2xl font-semibold text-slate-600 dark:text-slate-400">{workLog.requiredHours} <span className="text-sm">ساعت</span></p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">اضافه کار</p>
                        <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{workLog.overtimeHours} <span className="text-sm">ساعت</span></p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">مانده مرخصی فصل</p>
                        <p className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">{workLog.quarterlyLeaveRemaining} <span className="text-sm">روز</span></p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">مانده مرخصی سال</p>
                        <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{workLog.annualLeaveRemaining} <span className="text-sm">روز</span></p>
                    </div>
                </div>
            </div>
        )}

        {newsBanners && newsBanners.length > 0 && (
            <div className="mb-8 max-w-5xl mx-auto">
                <NewsCarousel banners={newsBanners} />
            </div>
        )}
        
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">صفحه پرسنلی - <span className="text-indigo-600 dark:text-indigo-400">{selectedMonth}</span></h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">از گزینه‌های زیر برای مشاهده برنامه بهبود، برگزاری آزمون یا دسترسی به محتوای آموزشی استفاده کنید.</p>
            
            {!assessmentExists && (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border-r-4 border-yellow-400 p-4 mb-6 rounded-md">
                    <p className="text-yellow-800 dark:text-yellow-200">ارزیابی برای این ماه ثبت نشده است. برخی گزینه‌ها ممکن است غیرفعال باشند.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Suggestions */}
                <button
                    onClick={handleGetComprehensiveSuggestions}
                    disabled={isSuggestionLoading || !hasWeakSkillsInSelectedMonth}
                    className="group relative flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg shadow-sm hover:shadow-lg hover:bg-white dark:hover:bg-slate-700 transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-sm"
                >
                    <AiIcon className="w-16 h-16 mb-4 text-indigo-500 transition-transform duration-300 group-hover:scale-110" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">برنامه جامع پیشنهادی</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        دریافت برنامه مطالعه ۳۰ روزه بر اساس نقاط ضعف.
                    </p>
                    {assessmentExists && !hasWeakSkillsInSelectedMonth && (
                       <span className="absolute top-2 right-2 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">تکمیل</span>
                    )}
                </button>

                {/* Card 2: Exam */}
                <button
                    onClick={() => setAssessmentSubView('exam_list')}
                    disabled={!assessmentExists}
                    className="group relative flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg shadow-sm hover:shadow-lg hover:bg-white dark:hover:bg-slate-700 transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-sm"
                >
                    <ClipboardDocumentCheckIcon className="w-16 h-16 mb-4 text-purple-500 transition-transform duration-300 group-hover:scale-110" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">صفحه آزمون</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        برگزاری آزمون‌های تئوری مرتبط با مهارت‌ها.
                    </p>
                </button>

                {/* Card 3: Training */}
                <button
                    onClick={() => setAssessmentSubView('training_materials')}
                    className="group relative flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg shadow-sm hover:shadow-lg hover:bg-white dark:hover:bg-slate-700 transition-all duration-300 transform hover:-translate-y-1"
                >
                    <AcademicCapIcon className="w-16 h-16 mb-4 text-blue-500 transition-transform duration-300 group-hover:scale-110" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">صفحه آموزشی</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        دسترسی به منابع و محتواهای آموزشی تکمیلی.
                    </p>
                </button>

                {/* Card 4: Accreditation */}
                <button
                    onClick={() => setAssessmentSubView('accreditation_materials')}
                    className="group relative flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg shadow-sm hover:shadow-lg hover:bg-white dark:hover:bg-slate-700 transition-all duration-300 transform hover:-translate-y-1"
                >
                    <ShieldCheckIcon className="w-16 h-16 mb-4 text-emerald-500 transition-transform duration-300 group-hover:scale-110" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">مطالب اعتباربخشی</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        دسترسی به دستورالعمل‌ها و مستندات اعتباربخشی.
                    </p>
                </button>
            </div>
        </div>
      </div>
    );
  };
  
  const renderExamList = (assessment: Assessment) => {
    const previousSubmissions = assessment.examSubmissions || [];
    return (
        <div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-4">لیست آزمون‌ها</h2>
                {examTemplates.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">آزمونی برای این بیمارستان تعریف نشده است.</p>
                ) : (
                    <div className="space-y-3">
                        {examTemplates.map(exam => (
                            <button key={exam.id} onClick={() => handleStartExam(exam)} className="w-full text-right p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors">
                                <h3 className="font-semibold text-lg text-indigo-600 dark:text-indigo-400">{exam.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{exam.questions.length} سوال</p>
                            </button>
                        ))}
                    </div>
                )}
                {previousSubmissions.length > 0 && (
                  <div className="mt-8">
                      <h3 className="text-xl font-bold mb-4 border-t pt-6 border-slate-200 dark:border-slate-700">آزمون‌های انجام شده</h3>
                       <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right text-slate-500 dark:text-slate-400">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                            <tr>
                                <th scope="col" className="px-6 py-3">نام آزمون</th>
                                <th scope="col" className="px-6 py-3">تاریخ انجام</th>
                                <th scope="col" className="px-6 py-3 text-center">نمره</th>
                                <th scope="col" className="px-6 py-3">
                                <span className="sr-only">مشاهده نتایج</span>
                                </th>
                            </tr>
                            </thead>
                            <tbody>
                            {previousSubmissions.map(sub => (
                                <tr key={sub.id} className="border-b dark:border-slate-700 odd:bg-white odd:dark:bg-slate-800 even:bg-slate-50 even:dark:bg-slate-700/50">
                                <td scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">
                                    {sub.examName}
                                </td>
                                <td className="px-6 py-4">
                                    {new Date(sub.submissionDate).toLocaleString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-lg">
                                    {sub.score} / {sub.totalCorrectableQuestions}
                                </td>
                                <td className="px-6 py-4 text-left">
                                    <button onClick={() => { setCurrentSubmissionResult(sub); setAssessmentSubView('exam_result'); }} className="font-medium text-indigo-600 dark:text-indigo-500 hover:underline">مشاهده نتایج</button>
                                </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        </div>
                  </div>
                )}
            </div>
        </div>
    );
  };
  
  const renderExamTaking = () => {
    if (!currentExam) return null;
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-1">آزمون: {currentExam.name}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">به سوالات زیر پاسخ دهید.</p>
        <div className="space-y-8">
          {currentExam.questions.map((q, index) => (
            <div key={q.id} className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <p className="font-semibold mb-3">سوال {index + 1}: {q.text}</p>
              {q.type === QuestionType.MultipleChoice ? (
                <div className="space-y-2">
                  {q.options?.map((opt, optIndex) => (
                    <label key={optIndex} className="flex items-center p-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={examAnswers.get(q.id) === opt}
                        onChange={(e) => handleExamAnswerChange(q.id, e.target.value)}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="mr-3">{opt}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  rows={5}
                  value={examAnswers.get(q.id) || ''}
                  onChange={(e) => handleExamAnswerChange(q.id, e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md dark:bg-slate-700 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="پاسخ خود را اینجا بنویسید..."
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end items-center mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
            <button onClick={handleSubmitExamClick} className="px-6 py-2 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">
                ثبت نهایی و مشاهده نتیجه
            </button>
        </div>
      </div>
    )
  };

  const renderExamResult = () => {
    if(!currentSubmissionResult) return null;
    const { questions, answers, score, totalCorrectableQuestions, examName } = currentSubmissionResult;
    const answersMap = new Map(answers.map(a => [a.questionId, a.answer]));
    
    const percentage = totalCorrectableQuestions > 0 ? (score / totalCorrectableQuestions) * 100 : 0;
    const PASS_THRESHOLD = 70;
    const isPass = percentage >= PASS_THRESHOLD;

    return (
       <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-2xl font-bold">نتیجه آزمون: {examName}</h2>
              <p className="text-slate-500 dark:text-slate-400">نتیجه سوالات شما در زیر آمده است.</p>
            </div>
        </div>
        
        {totalCorrectableQuestions > 0 && (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-6 mb-6 flex flex-col sm:flex-row justify-around items-center text-center gap-4">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">نمره کسب شده</p>
                    <p className="text-4xl font-bold text-slate-800 dark:text-slate-100">{score} <span className="text-2xl">/ {totalCorrectableQuestions}</span></p>
                </div>
                <div className="w-px h-16 bg-slate-200 dark:bg-slate-600 hidden sm:block"></div>
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">درصد</p>
                    <p className="text-4xl font-bold text-slate-800 dark:text-slate-100">{percentage.toFixed(1)}<span className="text-2xl">%</span></p>
                </div>
                <div className="w-px h-16 bg-slate-200 dark:bg-slate-600 hidden sm:block"></div>
                 <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">وضعیت</p>
                    <p className={`text-4xl font-bold ${isPass ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isPass ? 'قبول' : 'مردود'}
                    </p>
                </div>
            </div>
        )}

        <h3 className="text-xl font-bold mb-4">پاسخنامه</h3>
        <div className="space-y-6">
           {questions.map((q, index) => {
              const userAnswer = answersMap.get(q.id) || 'پاسخ داده نشده';
              const isCorrect = q.type === QuestionType.MultipleChoice && userAnswer === q.correctAnswer;
              const isMC = q.type === QuestionType.MultipleChoice;

              return (
                <div key={q.id} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700">
                  <p className="font-semibold mb-2">سوال {index+1}: {q.text}</p>
                  <p className={`p-2 rounded w-full ${isMC ? (isCorrect ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300') : 'bg-blue-100 dark:bg-blue-900/50 text-slate-800 dark:text-slate-200'}`}>
                    <strong>پاسخ شما:</strong> {userAnswer}
                  </p>
                  {isMC && !isCorrect && (
                     <p className="mt-2 p-2 rounded w-full bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200">
                       <strong>پاسخ صحیح:</strong> {q.correctAnswer}
                     </p>
                  )}
                  {!isMC && (
                     <p className="mt-2 p-2 rounded w-full bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200">
                       <strong>پاسخ نمونه:</strong> {q.correctAnswer}
                     </p>
                  )}
                </div>
              );
           })}
        </div>
       </div>
    );
  };

  const renderTrainingMaterials = () => {
    const allMaterialsByMonth = trainingMaterials;

    return (
        <div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-4">آرشیو محتوای آموزشی</h2>
                
                {allMaterialsByMonth.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">هیچ محتوای آموزشی برای این بیمارستان بارگذاری نشده است.</p>
                ) : (
                    <div className="space-y-8">
                        {allMaterialsByMonth.map(monthlyTraining => (
                            <div key={monthlyTraining.month}>
                                <h3 className="text-xl font-semibold mb-4 pb-2 border-b-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                                    {monthlyTraining.month}
                                </h3>
                                {monthlyTraining.materials.length === 0 ? (
                                    <p className="text-slate-400">محتوایی برای این ماه وجود ندارد.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {monthlyTraining.materials.map(material => {
                                            const { icon, color } = getIconForMimeType(material.type);
                                            return (
                                                <button
                                                    key={material.id}
                                                    onClick={() => setPreviewMaterial(material)}
                                                    className="group relative flex flex-col text-right p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg shadow-sm hover:shadow-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-800 dark:text-slate-200"
                                                >
                                                    <div className={`mb-3 ${color}`}>
                                                        {icon}
                                                    </div>
                                                    <h4 className="font-bold text-sm break-all w-full truncate" title={material.name}>{material.name}</h4>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 h-8 overflow-hidden text-ellipsis">
                                                        {material.description || 'بدون توضیح'}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderAccreditationMaterials = () => {
    return (
        <div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-4">آرشیو مطالب اعتباربخشی</h2>
                
                {accreditationMaterials.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">هیچ محتوای اعتباربخشی برای این بیمارستان بارگذاری نشده است.</p>
                ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {accreditationMaterials.map(material => {
                            const { icon, color } = getIconForMimeType(material.type);
                            return (
                                <button
                                    key={material.id}
                                    onClick={() => setPreviewMaterial(material)}
                                    className="group relative flex flex-col text-right p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg shadow-sm hover:shadow-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-800 dark:text-slate-200"
                                >
                                    <div className={`mb-3 ${color}`}>
                                        {icon}
                                    </div>
                                    <h4 className="font-bold text-sm break-all w-full truncate" title={material.name}>{material.name}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 h-8 overflow-hidden text-ellipsis">
                                        {material.description || 'بدون توضیح'}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderAssessmentResult = () => {
    const assessment = selectedMonth ? assessmentsByMonth.get(selectedMonth) : undefined;
    
    if (!assessment) {
        if (assessmentSubView === 'training_materials') {
            return renderTrainingMaterials();
        }
        if (assessmentSubView === 'accreditation_materials') {
            return renderAccreditationMaterials();
        }
        // For staff or anyone else without an assessment for the month,
        // show the summary page, which handles this case gracefully.
        // Or if trying to access another page, redirect to summary.
        return renderAssessmentSummary();
    }
    
    switch(assessmentSubView) {
        case 'summary': return renderAssessmentSummary();
        case 'exam_list': return renderExamList(assessment);
        case 'exam_taking': return renderExamTaking();
        case 'exam_result': return renderExamResult();
        case 'training_materials': return renderTrainingMaterials();
        case 'accreditation_materials': return renderAccreditationMaterials();
        case 'details':
        default:
            return renderAssessmentDetails(assessment);
    }
  };


  const renderMonthSelector = () => {
    const MONTH_DECORATIONS = [
      { base: 'border-t-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/50', text: 'text-teal-800 dark:text-teal-300', status: 'text-teal-500 dark:text-teal-400' },
      { base: 'border-t-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/50', text: 'text-sky-800 dark:text-sky-300', status: 'text-sky-500 dark:text-sky-400' },
      { base: 'border-t-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/50', text: 'text-amber-800 dark:text-amber-300', status: 'text-amber-500 dark:text-amber-400' },
      { base: 'border-t-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/50', text: 'text-rose-800 dark:text-rose-300', status: 'text-rose-500 dark:text-rose-400' },
      { base: 'border-t-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/50', text: 'text-violet-800 dark:text-violet-300', status: 'text-violet-500 dark:text-violet-400' },
      { base: 'border-t-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/50', text: 'text-lime-800 dark:text-lime-300', status: 'text-lime-500 dark:text-lime-400' },
    ];

    return (
      <div>
        {progressChartInfo.data.length > 0 && (
           <div className="mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">نمودار پیشرفت مهارت‌ها</h2>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={progressChartInfo.data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="5 5" stroke="rgba(100, 116, 139, 0.3)" />
                    <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 12 }} className="text-slate-500 dark:text-slate-400" />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fill: 'currentColor', fontSize: 12 }} className="text-slate-500 dark:text-slate-400" />
                    <Tooltip
                      cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5' }}
                      contentStyle={{ 
                          backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                          borderColor: '#334155',
                          borderRadius: '0.5rem',
                      }}
                      labelStyle={{ color: '#f1f5f9' }}
                      formatter={(value: number | null, name: string) => {
                        if (value === null || value === undefined) {
                          return ["ثبت نشده", name];
                        }
                        return [`${value}%`, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                    {progressChartInfo.categoryNames.map((catName, index) => {
                        return <Line key={catName} type="monotone" dataKey={catName} name={catName} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2} activeDot={{ r: 8 }} connectNulls/>
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
             </div>
           </div>
        )}

        <h2 className="text-2xl font-bold mb-4">انتخاب ماه برای مشاهده یا ثبت ارزیابی</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {PERSIAN_MONTHS.map((month, index) => {
                const hasAssessment = assessmentsByMonth.has(month);
                const isSelected = month === selectedMonth;
                const decoration = MONTH_DECORATIONS[index % MONTH_DECORATIONS.length];
                return (
                    <button
                        key={month}
                        onClick={() => handleMonthSelect(month)}
                        className={`p-6 rounded-lg text-center font-semibold transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900
                            ${isSelected 
                                ? 'bg-indigo-600 text-white shadow-lg scale-105 ring-indigo-500' 
                                : hasAssessment 
                                    ? `bg-white dark:bg-slate-800 shadow-md hover:-translate-y-1 border-t-4 ${decoration.base} ${decoration.text}`
                                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600'}`}
                    >
                        {month}
                        {hasAssessment && !isSelected && <span className={`block text-xs font-normal mt-1 ${decoration.status}`}>ثبت شده</span>}
                    </button>
                );
            })}
        </div>
      </div>
    );
  };
  
  const renderView = () => {
    switch(viewMode) {
      case 'assessment_form':
        return renderAssessmentForm();
      case 'assessment_result':
        return renderAssessmentResult();
      case 'month_selection':
      default:
        return renderMonthSelector();
    }
  };


  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
            {viewMode !== 'month_selection' && (
              <button
                onClick={handleInternalBack}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 dark:bg-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600"
                aria-label="Back to previous step"
              >
                <BackIcon className="w-5 h-5" />
                بازگشت
              </button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{staffMember.name}</h1>
              <p className="text-slate-500 dark:text-slate-400">{staffMember.title} - بخش {department.name}</p>
            </div>
        </div>
      </div>
      
      {renderView()}

      <SuggestionModal
        isOpen={isSuggestionModalOpen}
        onClose={() => setIsSuggestionModalOpen(false)}
        title={`برنامه پیشنهادی برای ${staffMember.name}`}
        content={suggestionContent}
        isLoading={isSuggestionLoading}
      />

      <Modal isOpen={isChecklistModalOpen} onClose={() => setIsChecklistModalOpen(false)} title="انتخاب قالب چک لیست">
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">یک قالب برای شروع ارزیابی این ماه انتخاب کنید.</p>
          {checklistTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => handleStartAssessmentWithTemplate(template)}
              className="w-full text-right p-3 bg-slate-50 dark:bg-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors"
            >
              <h4 className="font-semibold text-indigo-700 dark:text-indigo-400">{template.name}</h4>
              <p className="text-xs text-slate-400">{template.categories.length} دسته, {template.categories.reduce((acc, cat) => acc + cat.items.length, 0)} مورد</p>
            </button>
          ))}
        </div>
      </Modal>

      <PreviewModal isOpen={!!previewMaterial} onClose={() => setPreviewMaterial(null)} material={previewMaterial!}/>
    </div>
  );
};

export default StaffMemberView;