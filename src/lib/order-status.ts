import type { OrderResponse } from '@/services/orderApi';

export interface OrderStatusMeta {
  color: 'green' | 'gold' | 'blue' | 'red' | 'default' | 'magenta' | 'purple' | 'cyan';
  label: string;
  step: number;
  description: string;
}

export interface TrackingStepItem {
  title: string;
  description?: string;
  status: 'wait' | 'process' | 'finish' | 'error';
}

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  switch (status.toUpperCase()) {
    case 'CREATED':
    case 'PENDING':
      return {
        color: 'gold',
        label: 'Chờ xử lý',
        step: 1,
        description: 'Đơn hàng đã được ghi nhận và đang chờ xử lý.',
      };
    case 'VALIDATED':
      return {
        color: 'blue',
        label: 'Đã reserve',
        step: 2,
        description: 'Inventory đã giữ tạm tài nguyên và hệ thống đang chờ kết quả thanh toán.',
      };
    case 'CONFIRMED':
      return {
        color: 'cyan',
        label: 'Đã confirm reservation',
        step: 4,
        description: 'Reservation đã được xác nhận sau khi thanh toán thành công.',
      };
    case 'PROCESSING':
    case 'PAID':
      return {
        color: 'blue',
        label: 'Đang xử lý',
        step: 3,
        description: 'Hệ thống đang chờ hoặc đang xử lý kết quả thanh toán.',
      };
    case 'SHIPPING':
      return {
        color: 'cyan',
        label: 'Đang giao',
        step: 3,
        description: 'Đơn hàng đã được bàn giao cho đơn vị vận chuyển.',
      };
    case 'COMPLETED':
    case 'DELIVERED':
      return {
        color: 'green',
        label: 'Hoàn tất',
        step: 5,
        description: 'Đơn hàng đã hoàn tất thành công; reservation đã được confirm và status event đã được phát.',
      };
    case 'PAYMENT_FAILED':
      return {
        color: 'magenta',
        label: 'Payment failed',
        step: 4,
        description: 'Thanh toán thất bại, hệ thống sẽ release reservation và đóng đơn theo nhánh lỗi.',
      };
    case 'FAILED':
    case 'CANCELLED':
      return {
        color: 'red',
        label: 'Thất bại',
        step: 5,
        description: 'Đơn hàng không thể hoàn tất và reservation được trả lại nếu đã giữ trước đó.',
      };
    default:
      return {
        color: 'default',
        label: status || 'Đang cập nhật',
        step: 1,
        description: 'Trạng thái đơn hàng đang được cập nhật.',
      };
  }
}

export function getOrderTrackingSteps(order: Pick<OrderResponse, 'status'>): TrackingStepItem[] {
  const normalizedStatus = order.status.toUpperCase();

  const steps: TrackingStepItem[] = [
    { title: 'Tiếp nhận đơn', description: 'Order service ghi nhận đơn hàng mới.', status: 'finish' },
    { title: 'Reserve inventory', description: 'Inventory giữ tạm tài nguyên theo reservation.', status: 'wait' },
    { title: 'Payment result', description: 'Payment service trả kết quả cho flow xử lý đơn hàng.', status: 'wait' },
    { title: 'Confirm hoặc Release', description: 'Thanh toán thành công thì confirm, thất bại hoặc huỷ thì release.', status: 'wait' },
    { title: 'Final status', description: 'Đơn chốt COMPLETED hoặc PAYMENT_FAILED / FAILED.', status: 'wait' },
  ];

  switch (normalizedStatus) {
    case 'PENDING':
    case 'CREATED':
      steps[1].status = 'process';
      break;
    case 'VALIDATED':
      steps[1].status = 'finish';
      steps[2].status = 'process';
      break;
    case 'PROCESSING':
    case 'PAID':
      steps[1].status = 'finish';
      steps[2].status = 'finish';
      steps[3].status = 'process';
      break;
    case 'CONFIRMED':
      steps[1].status = 'finish';
      steps[2].status = 'finish';
      steps[3].status = 'finish';
      steps[4].status = 'process';
      break;
    case 'COMPLETED':
    case 'DELIVERED':
      return steps.map((step) => ({ ...step, status: 'finish' }));
    case 'PAYMENT_FAILED':
      steps[1].status = 'finish';
      steps[2].status = 'error';
      steps[3].status = 'finish';
      steps[4].status = 'error';
      return steps;
    case 'FAILED':
    case 'CANCELLED':
      steps[1].status = 'error';
      steps[2].status = 'wait';
      steps[3].status = 'finish';
      steps[4].status = 'error';
      return steps;
    default:
      steps[1].status = 'process';
      break;
  }

  return steps;
}
