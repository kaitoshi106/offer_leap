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
    visuallyHidden: { profile: 'Hồ sơ', newTab: '(mở trong tab mới)' },
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
    visuallyHidden: { profile: 'Profile', newTab: '(opens in a new tab)' },
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
