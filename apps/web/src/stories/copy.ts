import { DEFAULT_LOCALE, isLocale, type Locale } from '@offerleap/shared';

/**
 * Demo text for stories, per locale. Atoms never translate themselves (callers pass text), so stories feed them
 * sample copy that follows the Storybook "Language" toolbar. Not shipped to the app.
 */
const STORY_COPY = {
  vi: {
    button: { upload: 'Tải CV lên', uploading: 'Đang tải lên', next: 'Tiếp tục' },
    input: {
      email: 'Email',
      emailPlaceholder: 'ban@example.com',
      search: 'Tìm kỹ năng…',
      clear: 'Xoá nội dung',
    },
    textarea: { label: 'Mô tả công việc', placeholder: 'Dán mô tả công việc (JD) vào đây…' },
    label: { fullName: 'Họ và tên' },
    checkbox: { remote: 'Làm việc từ xa', selectAll: 'Chọn tất cả' },
    radio: { legend: 'Hình thức làm việc', options: ['Tại văn phòng', 'Từ xa', 'Kết hợp'] },
    heading: { title: 'Từ CV đến offer', level: 'Tiêu đề cấp' },
    text: { body: 'AI đọc CV và điền sẵn hồ sơ của bạn trong vài giây.' },
    badge: {
      ai: 'AI gợi ý',
      draft: 'Bản nháp',
      applied: 'Đã ứng tuyển',
      offer: 'Có offer',
      review: 'Cần kiểm tra',
      rejected: 'Bị từ chối',
      interview: 'Phỏng vấn',
    },
    spinner: { reading: 'Đang đọc CV…' },
    formField: {
      email: 'Email',
      hint: 'Chúng tôi không chia sẻ email của bạn.',
      error: 'Email không hợp lệ.',
    },
    password: { label: 'Mật khẩu', show: 'Hiện mật khẩu', hide: 'Ẩn mật khẩu' },
    alert: {
      infoTitle: 'Mẹo',
      info: 'Tải CV dạng PDF để AI đọc chính xác nhất.',
      success: 'Đã lưu hồ sơ.',
      warning: 'Hồ sơ còn thiếu kinh nghiệm làm việc.',
      danger: 'Không tải được CV. Vui lòng thử lại.',
    },
    dialog: {
      open: 'Xoá CV',
      title: 'Xoá CV này?',
      description: 'Thao tác không thể hoàn tác.',
      cancel: 'Huỷ',
      confirm: 'Xoá',
      close: 'Đóng',
    },
    toast: {
      show: 'Hiện thông báo',
      success: 'Đã lưu hồ sơ',
      description: 'Mọi thay đổi đã được cập nhật.',
      error: 'Không lưu được',
      dismiss: 'Ẩn thông báo',
    },
    authLayout: {
      title: 'Đăng nhập',
      description: 'Chào mừng bạn quay lại.',
      home: 'Về trang chủ',
      highlights: ['AI đọc CV trong vài giây', 'Chấm CV theo JD', 'Luyện phỏng vấn với AI'],
      match: 'Độ phù hợp với JD',
      ai: 'AI đã điền hồ sơ',
    },
    select: {
      label: 'Cấp bậc',
      placeholder: 'Chọn cấp bậc',
      options: ['Thực tập sinh', 'Junior', 'Senior', 'Trưởng nhóm'],
    },
    stepper: {
      label: 'Tiến độ',
      completed: '(đã xong)',
      steps: ['Cá nhân', 'Nghề nghiệp', 'Mong muốn', 'Xem lại'],
    },
    combobox: {
      label: 'Tỉnh/thành phố',
      placeholder: 'Tìm tỉnh/thành…',
      noResults: 'Không tìm thấy kết quả',
    },
    tagInput: { label: 'Kỹ năng', placeholder: 'VD: React', remove: 'Xoá' },
    focusLayout: {
      title: 'Hoàn thiện hồ sơ',
      body: 'Nội dung một tác vụ tập trung, ví dụ wizard onboarding.',
      signOut: 'Đăng xuất',
    },
    visuallyHidden: { profile: 'Hồ sơ', newTab: '(mở trong tab mới)' },
    pagination: {
      nav: 'Phân trang',
      previous: 'Trang trước',
      next: 'Trang sau',
      status: (page: number, pages: number) => `Trang ${page}/${pages}`,
    },
    scoreGauge: { label: 'Mức độ phù hợp' },
    appLayout: {
      navLabel: 'Điều hướng chính',
      overview: 'Tổng quan',
      analyses: 'Phân tích CV',
      signOut: 'Đăng xuất',
      title: 'Xin chào, Minh!',
      body: 'Hôm nay bạn muốn ứng tuyển vị trí nào?',
    },
    dropzone: {
      title: 'Kéo thả CV vào đây hoặc bấm để chọn file',
      hint: 'PDF, DOCX, PNG, JPG hoặc WEBP · tối đa 10 MB',
      accepted: 'Đã nhận',
      tooLarge: 'File quá lớn (tối đa 10 MB).',
      wrongType: 'Chỉ hỗ trợ file PDF, DOCX, PNG, JPG hoặc WEBP.',
    },
  },
  en: {
    button: { upload: 'Upload CV', uploading: 'Uploading', next: 'Continue' },
    input: { email: 'Email', emailPlaceholder: 'you@example.com', search: 'Search skills…', clear: 'Clear' },
    textarea: { label: 'Job description', placeholder: 'Paste the job description here…' },
    label: { fullName: 'Full name' },
    checkbox: { remote: 'Remote work', selectAll: 'Select all' },
    radio: { legend: 'Work type', options: ['On-site', 'Remote', 'Hybrid'] },
    heading: { title: 'From CV to offer', level: 'Heading level' },
    text: { body: 'AI reads your CV and pre-fills your profile in seconds.' },
    badge: {
      ai: 'AI suggested',
      draft: 'Draft',
      applied: 'Applied',
      offer: 'Offer',
      review: 'Needs review',
      rejected: 'Rejected',
      interview: 'Interview',
    },
    spinner: { reading: 'Reading your CV…' },
    formField: {
      email: 'Email',
      hint: "We'll never share your email.",
      error: 'Enter a valid email address.',
    },
    password: { label: 'Password', show: 'Show password', hide: 'Hide password' },
    alert: {
      infoTitle: 'Tip',
      info: 'Upload a PDF for the most accurate parsing.',
      success: 'Profile saved.',
      warning: 'Your profile is missing work experience.',
      danger: "Couldn't upload your CV. Please try again.",
    },
    dialog: {
      open: 'Delete CV',
      title: 'Delete this CV?',
      description: "This can't be undone.",
      cancel: 'Cancel',
      confirm: 'Delete',
      close: 'Close',
    },
    toast: {
      show: 'Show toast',
      success: 'Profile saved',
      description: 'All changes are up to date.',
      error: "Couldn't save",
      dismiss: 'Dismiss notification',
    },
    authLayout: {
      title: 'Sign in',
      description: 'Welcome back.',
      home: 'Back to home',
      highlights: [
        'AI reads your CV in seconds',
        'Score your CV against a JD',
        'Practise interviews with AI',
      ],
      match: 'Match with the JD',
      ai: 'AI filled in your profile',
    },
    select: {
      label: 'Seniority',
      placeholder: 'Choose a level',
      options: ['Intern', 'Junior', 'Senior', 'Team lead'],
    },
    stepper: {
      label: 'Progress',
      completed: '(done)',
      steps: ['Personal', 'Career', 'Preferences', 'Review'],
    },
    combobox: { label: 'Province or city', placeholder: 'Search provinces…', noResults: 'No results' },
    tagInput: { label: 'Skills', placeholder: 'e.g. React', remove: 'Remove' },
    focusLayout: {
      title: 'Complete your profile',
      body: 'A single focused task, such as the onboarding wizard.',
      signOut: 'Sign out',
    },
    visuallyHidden: { profile: 'Profile', newTab: '(opens in a new tab)' },
    pagination: {
      nav: 'Pagination',
      previous: 'Previous page',
      next: 'Next page',
      status: (page: number, pages: number) => `Page ${page} of ${pages}`,
    },
    scoreGauge: { label: 'Match score' },
    appLayout: {
      navLabel: 'Main navigation',
      overview: 'Overview',
      analyses: 'CV analysis',
      signOut: 'Sign out',
      title: 'Hi, Minh!',
      body: 'Which job are you applying for today?',
    },
    dropzone: {
      title: 'Drag your CV here or click to choose a file',
      hint: 'PDF, DOCX, PNG, JPG or WEBP · up to 10 MB',
      accepted: 'Accepted',
      tooLarge: 'The file is too large (max 10 MB).',
      wrongType: 'Only PDF, DOCX, PNG, JPG or WEBP files are supported.',
    },
  },
} satisfies Record<Locale, unknown>;

export type StoryCopy = (typeof STORY_COPY)['vi'];

/**
 * @description Picks the demo copy for the locale selected in the Storybook toolbar.
 * @param globals - Story context globals (`{ locale }`).
 * @returns Copy for that locale, falling back to the default locale.
 */
export function storyCopy(globals: Record<string, unknown>): StoryCopy {
  return STORY_COPY[isLocale(globals.locale) ? globals.locale : DEFAULT_LOCALE];
}
