"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ApiOutlined,
  DeploymentUnitOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  inventoryApi,
  type InventoryAvailabilityResponse,
} from "@/services/inventoryApi";
import {
  frameworkEvidenceApi,
  type FrameworkSkuOption,
  type OutboxRecentRow,
} from "@/services/frameworkEvidenceApi";
import { systemLinks } from "@/constants/systemLinks";

const { Paragraph, Text, Title } = Typography;

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function getAvailabilityStatusTag(data?: InventoryAvailabilityResponse) {
  if (!data) {
    return <Tag>Chưa có dữ liệu</Tag>;
  }

  if (data.availableStock <= 0) {
    return <Tag color="red">Hết khả dụng</Tag>;
  }

  if (data.availableStock <= Math.max(1, Math.ceil(data.physicalStock * 0.2))) {
    return <Tag color="gold">Sắp hết</Tag>;
  }

  return <Tag color="green">Khả dụng</Tag>;
}

function getOutboxStatusTag(status: string) {
  switch (status.toUpperCase()) {
    case "SENT":
      return <Tag color="green">SENT</Tag>;
    case "RETRY":
      return <Tag color="gold">RETRY</Tag>;
    case "FAILED":
      return <Tag color="red">FAILED</Tag>;
    case "NEW":
      return <Tag color="blue">NEW</Tag>;
    default:
      return <Tag>{status || "UNKNOWN"}</Tag>;
  }
}

export default function FrameworkEvidencePanel() {
  const [selectedSku, setSelectedSku] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [outboxMsgKeyInput, setOutboxMsgKeyInput] = useState("");
  const [outboxMsgKeyFilter, setOutboxMsgKeyFilter] = useState("");

  const { data: skuOptions = [], isLoading: skuLoading } = useQuery<
    FrameworkSkuOption[]
  >({
    queryKey: ["framework-sku-options"],
    queryFn: () => frameworkEvidenceApi.getSkuOptions(),
  });

  const defaultSku = skuOptions[0]?.skuCode ?? "";
  const effectiveSelectedSku = selectedSku || defaultSku;

  const {
    data: availability,
    isLoading: availabilityLoading,
    isError: availabilityError,
    refetch: refetchAvailability,
  } = useQuery<InventoryAvailabilityResponse>({
    queryKey: ["framework-availability", effectiveSelectedSku],
    queryFn: () => inventoryApi.getAvailability(effectiveSelectedSku),
    enabled: Boolean(effectiveSelectedSku),
    retry: 0,
  });

  const normalizedOutboxMsgKey = outboxMsgKeyFilter.trim().toUpperCase();

  const {
    data: outboxData,
    isLoading: outboxLoading,
    refetch: refetchOutbox,
  } = useQuery({
    queryKey: ["framework-outbox-recent", normalizedOutboxMsgKey],
    queryFn: () =>
      frameworkEvidenceApi.getRecentOutbox(8, {
        msgKey: normalizedOutboxMsgKey || undefined,
      }),
  });

  const selectedSkuMeta = useMemo(
    () =>
      skuOptions.find((item) => item.skuCode === effectiveSelectedSku) ?? null,
    [effectiveSelectedSku, skuOptions],
  );

  const outboxColumns: ColumnsType<OutboxRecentRow> = [
    {
      title: "Thời gian",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (value: string | undefined) => (
        <span className="text-xs text-[var(--color-secondary)]">
          {formatDateTime(value)}
        </span>
      ),
    },
    {
      title: "Event",
      dataIndex: "eventType",
      key: "eventType",
      render: (value: string, row) => (
        <div>
          <div className="font-medium text-[var(--color-primary)]">
            {value || "Không xác định"}
          </div>
          <div className="text-xs text-[var(--color-secondary)]">{row.topic}</div>
        </div>
      ),
    },
    {
      title: "Aggregate / Key",
      dataIndex: "msgKey",
      key: "msgKey",
      width: 180,
      render: (value: string | undefined, row) => (
        <div className="text-sm">
          <div className="font-medium">{value || "—"}</div>
          <div className="text-xs text-[var(--color-secondary)]">{row.eventId}</div>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value: string) => getOutboxStatusTag(value),
    },
    {
      title: "Retry",
      dataIndex: "retryCount",
      key: "retryCount",
      width: 80,
    },
  ];

  const applyOutboxFilter = () => {
    setOutboxMsgKeyFilter(outboxMsgKeyInput.trim().toUpperCase());
  };

  const clearOutboxFilter = () => {
    setOutboxMsgKeyInput("");
    setOutboxMsgKeyFilter("");
  };

  return (
    <div className="space-y-6">
      <div className="app-admin-card px-6 py-6 md:px-8 md:py-8">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Framework Evidence
        </div>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <Title
              level={2}
              className="!mb-2 !mt-0 !text-[30px] !font-semibold !tracking-tight"
            >
              LSF trong flow order → inventory → payment
            </Title>
            <Paragraph className="!mb-0 text-sm leading-6 text-[var(--color-secondary)] md:text-base">
              Màn này gom các bằng chứng kỹ thuật để demo trước hội đồng:
              availability theo SKU, recent outbox events, flow reserve /
              confirm / release, và các công cụ observability đi kèm.
            </Paragraph>
          </div>

          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void refetchAvailability()}>
              Tải lại availability
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refetchOutbox()}>
              Tải lại outbox
            </Button>
          </Space>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={11}>
          <Card
            className="app-admin-card border-0"
            title="Availability theo SKU"
            extra={getAvailabilityStatusTag(availability)}
          >
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <Select
                  value={effectiveSelectedSku || undefined}
                  options={skuOptions.map((item) => ({
                    label: `${item.skuCode}${item.productName ? ` — ${item.productName}` : ""}`,
                    value: item.skuCode,
                  }))}
                  loading={skuLoading}
                  onChange={(value) => {
                    setSelectedSku(value);
                    setManualSku(value);
                  }}
                  placeholder="Chọn SKU"
                />
                <Button
                  type="primary"
                  className="!bg-[var(--color-primary)]"
                  onClick={() => void refetchAvailability()}
                >
                  Xem nhanh
                </Button>
              </div>

              <Space.Compact className="w-full">
                <Input
                  placeholder="Hoặc nhập SKU thủ công, ví dụ: SKU-RED-40"
                  value={manualSku}
                  onChange={(event) => setManualSku(event.target.value.toUpperCase())}
                  onPressEnter={() => {
                    const normalizedSku = manualSku.trim().toUpperCase();
                    setManualSku(normalizedSku);
                    setSelectedSku(normalizedSku);
                  }}
                />
                <Button
                  type="primary"
                  className="!bg-[var(--color-primary)]"
                  onClick={() => {
                    const normalizedSku = manualSku.trim().toUpperCase();
                    setManualSku(normalizedSku);
                    setSelectedSku(normalizedSku);
                  }}
                >
                  Tra cứu
                </Button>
              </Space.Compact>

              {selectedSkuMeta ? (
                <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-secondary)]">
                  <div className="font-medium text-[var(--color-primary)]">
                    {selectedSkuMeta.productName}
                  </div>
                  <div className="mt-1">SKU: {selectedSkuMeta.skuCode}</div>
                  <div className="mt-1">
                    Biến thể: {selectedSkuMeta.color || "—"} / {selectedSkuMeta.size || "—"}
                  </div>
                </div>
              ) : null}

              {availabilityLoading ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <Spin />
                </div>
              ) : availabilityError ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Không tải được availability từ backend"
                  description="Kiểm tra inventory-service hoặc endpoint /api/inventory/{sku}/availability."
                />
              ) : availability ? (
                <Descriptions column={1} size="middle" bordered>
                  <Descriptions.Item label="SKU">{availability.skuCode}</Descriptions.Item>
                  <Descriptions.Item label="Physical stock">
                    {availability.physicalStock}
                  </Descriptions.Item>
                  <Descriptions.Item label="Quota used">
                    {availability.quotaUsed}
                  </Descriptions.Item>
                  <Descriptions.Item label="Reserved count">
                    {availability.reservedCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="Confirmed count">
                    {availability.confirmedCount}
                  </Descriptions.Item>
                  <Descriptions.Item label="Available stock">
                    <span className="font-semibold text-[var(--color-primary)]">
                      {availability.availableStock}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="Quota key">
                    {availability.quotaKey || "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Refreshed at">
                    {availability.refreshedAtEpochMs
                      ? new Date(availability.refreshedAtEpochMs).toLocaleString("vi-VN")
                      : "—"}
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Empty
                  description="Chọn SKU để xem availability"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={13}>
          <Card
            className="app-admin-card border-0"
            title="Outbox recent"
            extra={
              outboxData?.source === "fallback" ? (
                <Tag color="gold">Fallback demo data</Tag>
              ) : (
                <Tag color="green">API real-time</Tag>
              )
            }
          >
            <div className="space-y-4">
              <Alert
                type="info"
                showIcon
                message="Outbox gắn với order flow, không gắn trực tiếp với SKU"
                description="Dùng order number hoặc message key để lọc đúng các event của một flow cụ thể. Ví dụ: nhập order number để xem status event và confirm/release command liên quan tới đơn đó."
              />

              <Space.Compact className="w-full">
                <Input
                  placeholder="Lọc theo order number / message key, ví dụ: ORD-123"
                  value={outboxMsgKeyInput}
                  onChange={(event) => setOutboxMsgKeyInput(event.target.value.toUpperCase())}
                  onPressEnter={applyOutboxFilter}
                />
                <Button type="primary" className="!bg-[var(--color-primary)]" onClick={applyOutboxFilter}>
                  Lọc
                </Button>
                <Button onClick={clearOutboxFilter}>Xóa lọc</Button>
              </Space.Compact>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Text type="secondary">Bộ lọc hiện tại:</Text>
                {normalizedOutboxMsgKey ? (
                  <Tag color="blue">msgKey = {normalizedOutboxMsgKey}</Tag>
                ) : (
                  <Tag>Recent toàn hệ</Tag>
                )}
              </div>

              {outboxData?.source === "fallback" ? (
                <Alert
                  type="info"
                  showIcon
                  message="Đang dùng dữ liệu fallback"
                  description="Nếu order-service chưa mở /admin/outbox, gateway chưa route /api/system/outbox, hoặc token hiện tại chưa đủ quyền, bảng này sẽ hiển thị dữ liệu demo để không làm gãy UI."
                />
              ) : null}

              <Table
                rowKey={(row) => `${row.id}-${row.eventId}`}
                loading={outboxLoading}
                columns={outboxColumns}
                dataSource={outboxData?.rows || []}
                pagination={false}
                scroll={{ x: 720 }}
                locale={{
                  emptyText: normalizedOutboxMsgKey
                    ? "Không có outbox event nào khớp với message key hiện tại"
                    : "Chưa có outbox event nào để hiển thị",
                }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            className="app-admin-card border-0"
            title="Flow reserve / confirm / release"
          >
            <Steps
              direction="vertical"
              current={2}
              items={[
                {
                  title: "Tiếp nhận đơn",
                  description:
                    "Order service tạo đơn mới và ghi nhận trạng thái ban đầu.",
                  icon: <DeploymentUnitOutlined />,
                  status: "finish",
                },
                {
                  title: "Reserve inventory",
                  description:
                    "Inventory giữ tạm tài nguyên theo requestId để tránh oversell.",
                  icon: <SafetyCertificateOutlined />,
                  status: "finish",
                },
                {
                  title: "Payment result",
                  description:
                    "Payment service trả kết quả thành công hoặc thất bại cho orchestration.",
                  icon: <ApiOutlined />,
                  status: "process",
                },
                {
                  title: "Confirm hoặc Release",
                  description:
                    "Payment success → confirm reservation. Payment fail / huỷ → release reservation.",
                  icon: <ReloadOutlined />,
                  status: "wait",
                },
                {
                  title: "Final status",
                  description:
                    "Đơn chốt COMPLETED hoặc PAYMENT_FAILED / FAILED, đồng thời status event được phát qua outbox.",
                  icon: <LinkOutlined />,
                  status: "wait",
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="app-admin-card border-0" title="Quick links">
            <div className="space-y-3">
              {systemLinks.map((item) => (
                <a
                  key={item.key}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4 transition hover:border-[var(--color-border-strong)] hover:bg-white"
                >
                  <div>
                    <div className="font-medium text-[var(--color-primary)]">
                      {item.label}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-[var(--color-secondary)]">
                      {item.description}
                    </div>
                  </div>
                  <LinkOutlined className="mt-1 text-[var(--color-secondary)]" />
                </a>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
