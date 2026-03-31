'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Button, Card, Result, Spin, Steps, Tag, Typography } from 'antd';
import { HomeOutlined, LoadingOutlined, ReloadOutlined, WifiOutlined } from '@ant-design/icons';
import { orderApi, type OrderResponse } from '@/services/orderApi';
import { getOrderStatusMeta, getOrderTrackingSteps } from '@/lib/order-status';

const { Text, Title } = Typography;

const TERMINAL_STATUSES = new Set<OrderStatus>(['COMPLETED', 'FAILED', 'PAYMENT_FAILED', 'CANCELLED']);
const POLLING_INTERVAL_MS = 3000;
const STALE_RECHECK_MS = 12000;

type OrderStatus =
  | 'PENDING'
  | 'VALIDATED'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAYMENT_FAILED'
  | 'PROCESSING'
  | 'SHIPPING'
  | 'CONFIRMED'
  | 'CANCELLED';

interface NotificationMessage {
  status: OrderStatus;
  message: string;
}

interface PageState {
  status: OrderStatus;
  msg: string;
}

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

type SyncSource = 'api' | 'realtime' | 'initial';

function getCurrentStepIndex(status: string, steps: ReturnType<typeof getOrderTrackingSteps>) {
  const processIndex = steps.findIndex((step) => step.status === 'process');
  if (processIndex >= 0) return processIndex;
  const errorIndex = steps.findIndex((step) => step.status === 'error');
  if (errorIndex >= 0) return errorIndex;
  return Math.max(steps.length - 1, 0);
}

function getConnectionTag(state: ConnectionState) {
  switch (state) {
    case 'connected':
      return <Tag color="green" icon={<WifiOutlined />}>Realtime connected</Tag>;
    case 'reconnecting':
      return <Tag color="gold">Đang reconnect</Tag>;
    case 'disconnected':
      return <Tag>Đã ngắt kết nối</Tag>;
    default:
      return <Tag color="blue">Đang kết nối realtime</Tag>;
  }
}

function isTerminalStatus(status: OrderStatus) {
  return TERMINAL_STATUSES.has(status);
}

export default function OrderWaitingPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = params.orderNumber as string;

  const stompClientRef = useRef<Client | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const watchdogTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const inflightStatusRef = useRef(false);
  const latestStatusRef = useRef<OrderStatus>('PENDING');

  const [state, setState] = useState<PageState>({
    status: 'PENDING',
    msg: 'Đơn hàng đã được tiếp nhận và đang bắt đầu flow xử lý.',
  });
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncSource, setLastSyncSource] = useState<SyncSource>('initial');
  const [isPollingSync, setIsPollingSync] = useState(false);

  const trackingSteps = useMemo(() => getOrderTrackingSteps({ status: state.status }), [state.status]);
  const currentStepIndex = useMemo(() => getCurrentStepIndex(state.status, trackingSteps), [state.status, trackingSteps]);

  useEffect(() => {
    latestStatusRef.current = state.status;
  }, [state.status]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!orderNumber) return;

    const clearPollingInterval = () => {
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const clearWatchdogTimeout = () => {
      if (watchdogTimeoutRef.current !== null) {
        window.clearTimeout(watchdogTimeoutRef.current);
        watchdogTimeoutRef.current = null;
      }
    };

    const scheduleWatchdog = (fetchStatus: (source: SyncSource) => Promise<void>) => {
      clearWatchdogTimeout();

      if (isTerminalStatus(latestStatusRef.current)) return;

      watchdogTimeoutRef.current = window.setTimeout(() => {
        if (!isTerminalStatus(latestStatusRef.current)) {
          void fetchStatus('api');
        }
      }, STALE_RECHECK_MS);
    };

    const applyStatus = (status: OrderStatus, message: string, source: SyncSource) => {
      if (!mountedRef.current) return;

      latestStatusRef.current = status;
      setState({
        status,
        msg: message || getOrderStatusMeta(status).description,
      });
      setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
      setLastSyncSource(source);
    };

    const fetchStatus = async (source: SyncSource = 'api') => {
      if (!orderNumber || inflightStatusRef.current) return;
      if (isTerminalStatus(latestStatusRef.current) && source !== 'initial') return;

      inflightStatusRef.current = true;
      if (source === 'api') {
        setIsPollingSync(true);
      }

      try {
        const data: OrderResponse = await orderApi.getOrderById(orderNumber);
        if (!data?.status) return;

        applyStatus(data.status as OrderStatus, getOrderStatusMeta(data.status).description, source);
      } catch (error) {
        console.error('Không thể đồng bộ trạng thái đơn hàng:', error);
      } finally {
        inflightStatusRef.current = false;
        if (source === 'api' && mountedRef.current) {
          setIsPollingSync(false);
        }
      }
    };

    const startPolling = () => {
      clearPollingInterval();

      pollingIntervalRef.current = window.setInterval(() => {
        if (isTerminalStatus(latestStatusRef.current)) {
          clearPollingInterval();
          return;
        }

        void fetchStatus('api');
      }, POLLING_INTERVAL_MS);
    };

    const connectWebSocket = () => {
      if (stompClientRef.current?.active) return;

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8087/ws';
      setConnectionState('connecting');

      const client = new Client({
        webSocketFactory: () => new SockJS(wsUrl),
        reconnectDelay: 5000,
        onConnect: () => {
          setConnectionState('connected');

          client.subscribe(`/topic/order/${orderNumber}`, (event) => {
            if (!event.body) return;

            try {
              const notification = JSON.parse(event.body) as NotificationMessage;
              applyStatus(
                notification.status,
                notification.message || getOrderStatusMeta(notification.status).description,
                'realtime',
              );
              if (isTerminalStatus(notification.status)) {
                clearPollingInterval();
                clearWatchdogTimeout();
              } else {
                scheduleWatchdog(fetchStatus);
              }
            } catch (error) {
              console.error('Không parse được notification realtime:', error);
            }
          });

          void fetchStatus('api');
          scheduleWatchdog(fetchStatus);
        },
        onWebSocketClose: () => {
          setConnectionState('reconnecting');
          scheduleWatchdog(fetchStatus);
        },
        onStompError: () => {
          setConnectionState('reconnecting');
          scheduleWatchdog(fetchStatus);
        },
        onDisconnect: () => {
          setConnectionState('disconnected');
        },
      });

      client.activate();
      stompClientRef.current = client;
    };

    void fetchStatus('initial');
    connectWebSocket();
    startPolling();
    scheduleWatchdog(fetchStatus);

    return () => {
      clearPollingInterval();
      clearWatchdogTimeout();
      if (stompClientRef.current?.active) {
        setConnectionState('disconnected');
        void stompClientRef.current.deactivate();
      }
      stompClientRef.current = null;
    };
  }, [orderNumber]);

  const syncHint = lastSyncedAt
    ? `Đồng bộ gần nhất: ${lastSyncedAt}${lastSyncSource === 'realtime' ? ' • realtime' : ' • polling/API'}`
    : 'Đang khởi tạo đồng bộ trạng thái';

  if (state.status === 'COMPLETED') {
    return (
      <div className="app-shell animate-fade-in py-10">
        <Card className="app-surface border-0">
          <Result
            status="success"
            title={<span className="text-3xl font-semibold tracking-tight">Đặt hàng thành công</span>}
            subTitle={`Mã đơn hàng: ${orderNumber}. Reservation đã được confirm và status event cuối đã được phát qua hệ thống.`}
            extra={
              <div className="flex flex-wrap justify-center gap-3">
                <Button type="primary" size="large" className="!bg-[var(--color-primary)] !shadow-none" onClick={() => router.push('/')}>
                  Tiếp tục mua sắm
                </Button>
                <Button size="large" onClick={() => router.push('/orders')}>
                  Xem đơn hàng của tôi
                </Button>
              </div>
            }
          />
          <div className="space-y-3 px-6 pb-8 md:px-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {getConnectionTag(connectionState)}
              <Tag color="blue">{syncHint}</Tag>
            </div>
            <Steps current={4} items={trackingSteps} responsive />
          </div>
        </Card>
      </div>
    );
  }

  const isFailure = ['FAILED', 'PAYMENT_FAILED', 'CANCELLED'].includes(state.status);

  if (isFailure) {
    return (
      <div className="app-shell animate-fade-in py-10">
        <Card className="app-surface border-0">
          <Result
            status="error"
            title={<span className="text-3xl font-semibold tracking-tight">Đơn hàng không hoàn tất</span>}
            subTitle={state.msg}
            extra={
              <div className="flex flex-wrap justify-center gap-3">
                <Button danger type="primary" size="large" onClick={() => router.push('/checkout')}>
                  Thử lại
                </Button>
                <Button size="large" icon={<HomeOutlined />} onClick={() => router.push('/')}>
                  Về trang chủ
                </Button>
              </div>
            }
          />
          <div className="space-y-4 px-6 pb-8 md:px-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {getConnectionTag(connectionState)}
              <Tag color="blue">{syncHint}</Tag>
            </div>
            <Steps current={currentStepIndex} items={trackingSteps} responsive />
            <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-secondary)]">
              {state.status === 'PAYMENT_FAILED'
                ? 'Payment không thành công nên hệ thống thực hiện release reservation trước khi chốt trạng thái lỗi.'
                : 'Flow xử lý dừng ở nhánh lỗi, reservation sẽ được trả lại nếu đã giữ trước đó.'}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell animate-fade-in py-10">
      <Card className="app-surface border-0">
        <div className="px-2 py-8 text-center md:px-10 md:py-12">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 64, color: '#111111' }} spin />} />
          <Title level={2} className="!mb-2 !mt-8 !font-semibold">
            Đơn hàng đang được xử lý theo flow framework
          </Title>
          <Text className="text-base text-[var(--color-secondary)]">{state.msg}</Text>

          <div className="mx-auto mt-10 max-w-4xl rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-left">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Mã đơn hàng</div>
                <div className="mt-1 text-sm font-semibold text-[var(--color-primary)]">{orderNumber}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isPollingSync ? <Tag color="processing">Đang đồng bộ fallback</Tag> : null}
                {getConnectionTag(connectionState)}
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-left">
              <Tag color="blue">{syncHint}</Tag>
              <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
                Làm mới trạng thái
              </Button>
            </div>
            <Steps current={currentStepIndex} items={trackingSteps} responsive />
          </div>

          <div className="mx-auto mt-8 max-w-4xl rounded-[24px] border border-[var(--color-border)] bg-white p-5 text-left text-sm text-[var(--color-secondary)]">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">Giải thích nhanh</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <div className="font-medium text-[var(--color-primary)]">Reserve inventory</div>
                <div className="mt-1 leading-6">Inventory chỉ giữ tạm tài nguyên trước khi chốt kết quả thanh toán để tránh oversell.</div>
              </div>
              <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <div className="font-medium text-[var(--color-primary)]">Confirm hoặc Release</div>
                <div className="mt-1 leading-6">Payment success thì confirm reservation, còn failure/cancel thì release để trả lại tài nguyên.</div>
              </div>
            </div>
            <div className="mt-4 rounded-[18px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm leading-6 text-[var(--color-secondary)]">
              Trang này dùng <strong>realtime + polling fallback</strong>. Nếu WebSocket bị miss event hoặc reconnect chậm, UI vẫn tự đồng bộ lại trạng thái đơn hàng qua API để tránh kẹt ở bước giữa.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
