export interface SystemLinkItem {
  key: 'grafana' | 'zipkin' | 'phpmyadmin' | 'outbox';
  label: string;
  description: string;
  url: string;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const systemLinks: SystemLinkItem[] = [
  {
    key: 'grafana',
    label: 'Grafana',
    description: 'Theo dõi metrics và dashboard vận hành.',
    url: process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:3000',
  },
  {
    key: 'zipkin',
    label: 'Zipkin',
    description: 'Kiểm tra tracing giữa các service.',
    url: process.env.NEXT_PUBLIC_ZIPKIN_URL || 'http://localhost:9411',
  },
  {
    key: 'phpmyadmin',
    label: 'phpMyAdmin',
    description: 'Mở nhanh MySQL để kiểm tra bảng và dữ liệu demo.',
    url: process.env.NEXT_PUBLIC_PHPMYADMIN_URL || 'http://localhost:8085',
  },
  {
    key: 'outbox',
    label: 'Outbox Admin API',
    description: 'Xem trực tiếp recent events của LSF outbox.',
    url: process.env.NEXT_PUBLIC_OUTBOX_ADMIN_URL || `${apiBase}/admin/outbox`,
  },
];

export function getSystemLinkUrl(key: SystemLinkItem['key']): string {
  return systemLinks.find((item) => item.key === key)?.url || '#';
}
