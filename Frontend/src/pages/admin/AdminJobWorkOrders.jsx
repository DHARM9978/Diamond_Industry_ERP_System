import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    ClipboardList,
    Eye,
    Plus,
    RefreshCw,
    Search,
} from 'lucide-react';

import {
    PageHeader,
    DataTable,
} from '@/components/ui/PageComponents';

import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/Form';
import { useToast } from '@/context/ToastContext';
import apiClient from '@/services/apiClient';

// ============================================================
// API ENDPOINTS
// ============================================================

const JOB_WORK_ORDERS_ENDPOINT = '/api/job-work/orders';
const PROCESSORS_ENDPOINT = '/api/job-work/processors';
const PROCESS_TYPES_ENDPOINT = '/api/job-work/process-types';
const PROCESS_RATES_ENDPOINT = '/api/job-work/process-rates';
const BRANCHES_ENDPOINT = '/api/branches';

// ============================================================
// CONSTANTS
// ============================================================

const JOB_STATUSES = [
    { value: 'OPEN', label: 'Open' },
    { value: 'PARTIALLY_RETURNED', label: 'Partially Returned' },
    {
        value: 'AWAITING_RECONCILIATION',
        label: 'Awaiting Reconciliation',
    },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

const CHARGE_UNITS = [
    { value: 'PER_CARAT', label: 'Per carat' },
    { value: 'PER_PIECE', label: 'Per piece' },
    { value: 'PER_GRAM', label: 'Per gram' },
    { value: 'PER_JOB', label: 'Per job / fixed charge' },
];

// ============================================================
// HELPERS
// ============================================================

const normalizeText = (value) => String(value ?? '').trim();

const getErrorMessage = (error, fallback) => (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.data?.message ||
    error?.message ||
    fallback
);

const getTodayDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const getMonthFromDate = (dateValue) => {
    if (!dateValue) {
        return '';
    }

    return String(dateValue).slice(0, 7);
};

const formatDate = (value) => {
    if (!value) {
        return '—';
    }

    const dateText = String(value).slice(0, 10);
    const parts = dateText.split('-');

    if (parts.length !== 3) {
        return dateText;
    }

    const [year, month, day] = parts;

    if (!year || !month || !day) {
        return dateText;
    }

    return `${day}/${month}/${year}`;
};

const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') {
        return 'Not set';
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return 'Not set';
    }

    return `₹${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const getChargeUnitLabel = (value) => (
    CHARGE_UNITS.find((unit) => unit.value === value)?.label ||
    (value
        ? String(value).replaceAll('_', ' ').toLowerCase()
        : 'Not specified')
);

const getStatusLabel = (status) => (
    JOB_STATUSES.find((item) => item.value === status)?.label ||
    String(status || 'Unknown').replaceAll('_', ' ')
);

const getStatusClass = (status) => {
    switch (status) {
        case 'OPEN':
            return 'bg-blue-100 text-blue-700';

        case 'PARTIALLY_RETURNED':
            return 'bg-amber-100 text-amber-700';

        case 'AWAITING_RECONCILIATION':
            return 'bg-purple-100 text-purple-700';

        case 'COMPLETED':
            return 'bg-success-100 text-success-700';

        case 'CANCELLED':
            return 'bg-red-100 text-red-700';

        default:
            return 'bg-navy-100 text-navy-600';
    }
};

const extractRecords = (response) => {
    const payload = response?.data?.data;

    if (Array.isArray(payload)) {
        return payload;
    }

    if (payload && typeof payload === 'object') {
        const possibleArrays = [
            payload.records,
            payload.items,
            payload.branches,
            payload.processors,
            payload.processTypes,
            payload.rates,
        ];

        const found = possibleArrays.find(Array.isArray);

        if (found) {
            return found;
        }
    }

    return null;
};

const getRecordName = (record) => (
    record?.name ||
    record?.branchName ||
    record?.processorName ||
    record?.title ||
    'Unnamed'
);

const getQuoteAmount = (order) => (
    order?.quotedRate === null || order?.quotedRate === undefined
        ? 'Not set'
        : formatCurrency(order.quotedRate)
);

const normalizeId = (value) => {
    const id = Number(value);

    return Number.isInteger(id) && id > 0 ? id : '';
};

// ============================================================
// ADMIN JOB WORK ORDERS
// ============================================================

export function AdminJobWorkOrders() {
    const { toast } = useToast();

    // --------------------------------------------------------
    // DATA
    // --------------------------------------------------------

    const [orders, setOrders] = useState([]);
    const [branches, setBranches] = useState([]);
    const [processors, setProcessors] = useState([]);
    const [processTypes, setProcessTypes] = useState([]);

    const [loading, setLoading] = useState(true);
    const [lookupsLoading, setLookupsLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // --------------------------------------------------------
    // FILTERS
    // --------------------------------------------------------

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');

    // --------------------------------------------------------
    // CREATE FORM
    // --------------------------------------------------------

    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [formVersion, setFormVersion] = useState(0);

    const [form, setForm] = useState({
        jobNumber: '',
        branchId: '',
        externalProcessorId: '',
        processTypeId: '',
        orderDate: getTodayDate(),
        description: '',
        notes: '',
    });

    const [formErrors, setFormErrors] = useState({});

    // --------------------------------------------------------
    // MONTHLY RATE PREVIEW
    // --------------------------------------------------------

    const [ratePreview, setRatePreview] = useState(null);
    const [ratePreviewLoading, setRatePreviewLoading] = useState(false);
    const [ratePreviewFailed, setRatePreviewFailed] = useState(false);

    // --------------------------------------------------------
    // ORDER DETAILS
    // --------------------------------------------------------

    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // ========================================================
    // LOAD ORDERS
    // ========================================================

    const loadOrders = useCallback(async ({ showError = true } = {}) => {
        setLoading(true);

        try {
            const params = {};

            if (statusFilter) {
                params.status = statusFilter;
            }

            if (monthFilter) {
                params.orderMonth = monthFilter;
            }

            const response = await apiClient.get(
                JOB_WORK_ORDERS_ENDPOINT,
                { params }
            );

            const records = extractRecords(response);

            if (!records) {
                throw new Error(
                    'The server returned an invalid Job Work Orders list.'
                );
            }

            setOrders(records);

            return records;
        } catch (error) {
            if (showError) {
                toast(
                    getErrorMessage(
                        error,
                        'Unable to load Job Work Orders.'
                    ),
                    'error'
                );
            }

            throw error;
        } finally {
            setLoading(false);
        }
    }, [monthFilter, statusFilter, toast]);

    useEffect(() => {
        let cancelled = false;

        const initializeOrders = async () => {
            try {
                const params = {};

                if (statusFilter) {
                    params.status = statusFilter;
                }

                if (monthFilter) {
                    params.orderMonth = monthFilter;
                }

                const response = await apiClient.get(
                    JOB_WORK_ORDERS_ENDPOINT,
                    { params }
                );

                const records = extractRecords(response);

                if (!records) {
                    throw new Error(
                        'The server returned an invalid Job Work Orders list.'
                    );
                }

                if (!cancelled) {
                    setOrders(records);
                }
            } catch (error) {
                if (!cancelled) {
                    toast(
                        getErrorMessage(
                            error,
                            'Unable to load Job Work Orders.'
                        ),
                        'error'
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        initializeOrders();

        return () => {
            cancelled = true;
        };
    }, [monthFilter, statusFilter, toast]);

    // ========================================================
    // LOAD FORM DROPDOWNS
    // ========================================================

    useEffect(() => {
        let cancelled = false;

        const loadLookups = async () => {
            setLookupsLoading(true);

            const results = await Promise.allSettled([
                apiClient.get(BRANCHES_ENDPOINT),
                apiClient.get(PROCESSORS_ENDPOINT, {
                    params: { status: 'ACTIVE' },
                }),
                apiClient.get(PROCESS_TYPES_ENDPOINT, {
                    params: { status: 'ACTIVE' },
                }),
            ]);

            if (cancelled) {
                return;
            }

            const [branchResult, processorResult, processTypeResult] = results;

            let lookupFailed = false;

            if (branchResult.status === 'fulfilled') {
                const records = extractRecords(branchResult.value);

                if (records) {
                    setBranches(records);
                } else {
                    lookupFailed = true;
                }
            } else {
                lookupFailed = true;
            }

            if (processorResult.status === 'fulfilled') {
                const records = extractRecords(processorResult.value);

                if (records) {
                    setProcessors(records);
                } else {
                    lookupFailed = true;
                }
            } else {
                lookupFailed = true;
            }

            if (processTypeResult.status === 'fulfilled') {
                const records = extractRecords(processTypeResult.value);

                if (records) {
                    setProcessTypes(records);
                } else {
                    lookupFailed = true;
                }
            } else {
                lookupFailed = true;
            }

            if (lookupFailed) {
                toast(
                    'Some dropdown data could not be loaded. Check the Branches, External Processors and Processing Types APIs.',
                    'error'
                );
            }

            setLookupsLoading(false);
        };

        loadLookups();

        return () => {
            cancelled = true;
        };
    }, [toast]);

    // ========================================================
    // MONTHLY RATE PREVIEW
    // ========================================================

    useEffect(() => {
        if (!createModalOpen || !form.processTypeId || !form.orderDate) {
            setRatePreview(null);
            setRatePreviewFailed(false);
            setRatePreviewLoading(false);
            return undefined;
        }

        let cancelled = false;

        const loadRatePreview = async () => {
            setRatePreview(null);
            setRatePreviewFailed(false);
            setRatePreviewLoading(true);

            try {
                const rateMonth = getMonthFromDate(form.orderDate);

                const response = await apiClient.get(
                    PROCESS_RATES_ENDPOINT,
                    {
                        params: { rateMonth },
                    }
                );

                const records = extractRecords(response);

                if (!records) {
                    throw new Error(
                        'The server returned an invalid monthly rate list.'
                    );
                }

                const rate = records.find(
                    (item) =>
                        Number(item.processTypeId) ===
                        Number(form.processTypeId)
                );

                if (!cancelled) {
                    setRatePreview(rate || null);
                }
            } catch {
                if (!cancelled) {
                    setRatePreviewFailed(true);
                    setRatePreview(null);
                }
            } finally {
                if (!cancelled) {
                    setRatePreviewLoading(false);
                }
            }
        };

        loadRatePreview();

        return () => {
            cancelled = true;
        };
    }, [
        createModalOpen,
        form.orderDate,
        form.processTypeId,
    ]);

    // ========================================================
    // FILTERED ORDERS
    // ========================================================

    const filteredOrders = useMemo(() => {
        const term = search.trim().toLowerCase();

        return orders.filter((order) => {
            if (!term) {
                return true;
            }

            const searchableValues = [
                order.jobNumber,
                order.branch?.branchName,
                order.externalProcessor?.name,
                order.externalProcessor?.processorCode,
                order.processType?.name,
                order.processType?.code,
                order.description,
                order.notes,
            ];

            return searchableValues.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });
    }, [orders, search]);

    // ========================================================
    // CREATE FORM HANDLERS
    // ========================================================

    const openCreateModal = () => {
        setForm({
            jobNumber: '',
            branchId: '',
            externalProcessorId: '',
            processTypeId: '',
            orderDate: getTodayDate(),
            description: '',
            notes: '',
        });

        setFormErrors({});
        setFormVersion((value) => value + 1);
        setCreateModalOpen(true);
    };

    const closeCreateModal = () => {
        if (saving) {
            return;
        }

        setCreateModalOpen(false);
        setFormErrors({});
    };

    const handleFormChange = (field, value) => {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));

        setFormErrors((previous) => ({
            ...previous,
            [field]: '',
            form: '',
        }));
    };

    const validateForm = () => {
        const errors = {};

        const jobNumber = normalizeText(form.jobNumber);
        const branchId = normalizeId(form.branchId);
        const processorId = normalizeId(form.externalProcessorId);
        const processTypeId = normalizeId(form.processTypeId);
        const orderDate = normalizeText(form.orderDate);
        const description = normalizeText(form.description);
        const notes = normalizeText(form.notes);

        if (!jobNumber) {
            errors.jobNumber = 'Job number is required.';
        } else if (jobNumber.length > 40) {
            errors.jobNumber = 'Job number cannot exceed 40 characters.';
        }

        if (!branchId) {
            errors.branchId = 'Select a branch.';
        }

        if (!processorId) {
            errors.externalProcessorId = 'Select an external processor.';
        }

        if (!processTypeId) {
            errors.processTypeId = 'Select a processing type.';
        }

        if (!orderDate || !/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
            errors.orderDate = 'Enter a valid order date.';
        }

        if (description.length > 10000) {
            errors.description = 'Description is too long.';
        }

        if (notes.length > 10000) {
            errors.notes = 'Notes are too long.';
        }

        setFormErrors(errors);

        return Object.keys(errors).length === 0;
    };

    // ========================================================
    // CREATE JOB WORK ORDER
    // ========================================================

    const handleCreateOrder = async (event) => {
        event.preventDefault();

        if (saving || !validateForm()) {
            return;
        }

        try {
            setSaving(true);

            const payload = {
                jobNumber: normalizeText(form.jobNumber),
                branchId: Number(form.branchId),
                externalProcessorId: Number(form.externalProcessorId),
                processTypeId: Number(form.processTypeId),
                orderDate: form.orderDate,
                description: normalizeText(form.description) || null,
                notes: normalizeText(form.notes) || null,
            };

            const response = await apiClient.post(
                JOB_WORK_ORDERS_ENDPOINT,
                payload
            );

            const savedOrder = response?.data?.data;

            if (!savedOrder?.jobWorkOrderId) {
                throw new Error(
                    'The server did not return the created Job Work Order.'
                );
            }

            setCreateModalOpen(false);
            setFormErrors({});

            toast(
                response?.data?.message ||
                    'Job Work Order created successfully.',
                'success'
            );

            await loadOrders({ showError: true });
        } catch (error) {
            toast(
                getErrorMessage(
                    error,
                    'Unable to create Job Work Order.'
                ),
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    // ========================================================
    // VIEW ORDER DETAILS
    // ========================================================

    const handleViewOrder = async (order) => {
        setDetailsModalOpen(true);
        setDetailsLoading(true);
        setSelectedOrder(order);

        try {
            const response = await apiClient.get(
                `${JOB_WORK_ORDERS_ENDPOINT}/${order.jobWorkOrderId}`
            );

            const detail = response?.data?.data;

            if (!detail?.jobWorkOrderId) {
                throw new Error(
                    'The server did not return the order details.'
                );
            }

            setSelectedOrder(detail);
        } catch (error) {
            toast(
                getErrorMessage(
                    error,
                    'Unable to load Job Work Order details.'
                ),
                'error'
            );
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeDetailsModal = () => {
        setDetailsModalOpen(false);
        setSelectedOrder(null);
    };

    // ========================================================
    // TABLE COLUMNS
    // ========================================================

    const columns = [
        {
            key: 'jobNumber',
            label: 'Job Number',
            render: (order) => (
                <div className="min-w-[110px]">
                    <p className="font-semibold text-navy-900">
                        {order.jobNumber || '—'}
                    </p>

                    <p className="mt-0.5 text-xs text-navy-500">
                        ID: {order.jobWorkOrderId}
                    </p>
                </div>
            ),
        },
        {
            key: 'orderDate',
            label: 'Order Date',
            render: (order) => (
                <span className="whitespace-nowrap text-sm text-navy-700">
                    {formatDate(order.orderDate)}
                </span>
            ),
        },
        {
            key: 'branch',
            label: 'Branch',
            render: (order) => (
                <span className="text-sm text-navy-700">
                    {order.branch?.branchName || '—'}
                </span>
            ),
        },
        {
            key: 'externalProcessor',
            label: 'External Processor',
            render: (order) => (
                <div className="min-w-[140px]">
                    <p className="font-medium text-navy-900">
                        {order.externalProcessor?.name || '—'}
                    </p>

                    {order.externalProcessor?.processorCode && (
                        <p className="mt-0.5 text-xs text-navy-500">
                            {order.externalProcessor.processorCode}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'processType',
            label: 'Processing Type',
            render: (order) => (
                <div className="min-w-[130px]">
                    <p className="font-medium text-navy-800">
                        {order.processType?.name || '—'}
                    </p>

                    {order.processType?.code && (
                        <p className="mt-0.5 text-xs text-navy-500">
                            {order.processType.code}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'quotedRate',
            label: 'Quoted Rate',
            render: (order) => (
                <div>
                    <p className="font-medium text-navy-800">
                        {getQuoteAmount(order)}
                    </p>

                    {order.quotedChargeUnit && (
                        <p className="mt-0.5 text-xs text-navy-500">
                            {getChargeUnitLabel(order.quotedChargeUnit)}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            align: 'center',
            render: (order) => (
                <span
                    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(order.status)}`}
                >
                    {getStatusLabel(order.status)}
                </span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'center',
            render: (order) => (
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-700 transition hover:bg-navy-50"
                    onClick={() => handleViewOrder(order)}
                >
                    <Eye size={15} />
                    View
                </button>
            ),
        },
    ];

    // ========================================================
    // PAGE
    // ========================================================

    return (
        <div className="space-y-6">
            <PageHeader
                title="Job Work Orders"
                subtitle={`${orders.length} order${orders.length === 1 ? '' : 's'} recorded`}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-700 transition hover:bg-navy-50"
                            onClick={() => loadOrders().catch(() => {})}
                            disabled={loading}
                        >
                            <RefreshCw
                                size={16}
                                className={loading ? 'animate-spin' : ''}
                            />
                            Refresh
                        </button>

                        <button
                            type="button"
                            className="btn-primary"
                            onClick={openCreateModal}
                            disabled={saving || lookupsLoading}
                        >
                            <Plus size={18} />
                            Create Job Order
                        </button>
                    </div>
                }
            />

            {/* SEARCH AND FILTERS */}

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="w-full xl:max-w-sm">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Search job number, processor or process..."
                    />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="job-work-orders-month"
                            className="whitespace-nowrap text-sm font-medium text-navy-700"
                        >
                            Order Month
                        </label>

                        <input
                            id="job-work-orders-month"
                            type="month"
                            className="input-field min-w-[155px]"
                            value={monthFilter}
                            onChange={(event) =>
                                setMonthFilter(event.target.value)
                            }
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="job-work-orders-status"
                            className="text-sm font-medium text-navy-700"
                        >
                            Status
                        </label>

                        <select
                            id="job-work-orders-status"
                            className="input-field min-w-[165px]"
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value)
                            }
                        >
                            <option value="">All statuses</option>

                            {JOB_STATUSES.map((status) => (
                                <option
                                    key={status.value}
                                    value={status.value}
                                >
                                    {status.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {monthFilter && (
                        <button
                            type="button"
                            className="text-sm font-medium text-navy-600 underline underline-offset-2 hover:text-navy-900"
                            onClick={() => setMonthFilter('')}
                        >
                            Clear month
                        </button>
                    )}
                </div>
            </div>

            {/* ORDER LIST */}

            {loading && orders.length === 0 ? (
                <div className="rounded-xl border border-navy-100 bg-white p-8 text-center text-sm text-navy-500">
                    Loading Job Work Orders...
                </div>
            ) : filteredOrders.length === 0 ? (
                <EmptyState
                    icon={search.trim() ? Search : ClipboardList}
                    title={
                        orders.length === 0
                            ? 'No Job Work Orders yet'
                            : 'No matching Job Work Orders'
                    }
                    message={
                        orders.length === 0
                            ? 'Create a job order to record work assigned to an external processor.'
                            : 'Try a different search term or filter.'
                    }
                    action={
                        orders.length === 0 && !search.trim() ? (
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={openCreateModal}
                                disabled={lookupsLoading}
                            >
                                <Plus size={17} />
                                Create Job Order
                            </button>
                        ) : undefined
                    }
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={filteredOrders}
                    emptyMessage="No Job Work Orders found."
                />
            )}

            {/* CREATE ORDER MODAL */}

            <Modal
                open={createModalOpen}
                onClose={closeCreateModal}
                title="Create Job Work Order"
                size="lg"
            >
                <form
                    key={formVersion}
                    onSubmit={handleCreateOrder}
                    className="space-y-5"
                >
                    <p className="text-sm text-navy-600">
                        Record the processing job assigned to an external
                        processor. Dispatches and receipts are recorded
                        separately.
                    </p>

                    {/* JOB NUMBER AND DATE */}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label
                                htmlFor="job-work-order-number"
                                className="mb-1.5 block text-sm font-medium text-navy-700"
                            >
                                Job Number <span className="text-red-500">*</span>
                            </label>

                            <input
                                id="job-work-order-number"
                                type="text"
                                maxLength={40}
                                className="input-field w-full"
                                value={form.jobNumber}
                                onChange={(event) =>
                                    handleFormChange(
                                        'jobNumber',
                                        event.target.value
                                    )
                                }
                                placeholder="e.g. JW-2026-001"
                                required
                            />

                            {formErrors.jobNumber && (
                                <p className="mt-1 text-xs text-red-600">
                                    {formErrors.jobNumber}
                                </p>
                            )}
                        </div>

                        <div>
                            <label
                                htmlFor="job-work-order-date"
                                className="mb-1.5 block text-sm font-medium text-navy-700"
                            >
                                Order Date <span className="text-red-500">*</span>
                            </label>

                            <input
                                id="job-work-order-date"
                                type="date"
                                className="input-field w-full"
                                value={form.orderDate}
                                onChange={(event) =>
                                    handleFormChange(
                                        'orderDate',
                                        event.target.value
                                    )
                                }
                                required
                            />

                            {formErrors.orderDate && (
                                <p className="mt-1 text-xs text-red-600">
                                    {formErrors.orderDate}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* BRANCH */}

                    <div>
                        <label
                            htmlFor="job-work-order-branch"
                            className="mb-1.5 block text-sm font-medium text-navy-700"
                        >
                            Branch <span className="text-red-500">*</span>
                        </label>

                        <select
                            id="job-work-order-branch"
                            className="input-field w-full"
                            value={form.branchId}
                            onChange={(event) =>
                                handleFormChange(
                                    'branchId',
                                    event.target.value
                                )
                            }
                            disabled={lookupsLoading}
                            required
                        >
                            <option value="">
                                {lookupsLoading
                                    ? 'Loading branches...'
                                    : 'Select branch'}
                            </option>

                            {branches.map((branch) => (
                                <option
                                    key={branch.branchId}
                                    value={branch.branchId}
                                >
                                    {branch.branchName || getRecordName(branch)}
                                </option>
                            ))}
                        </select>

                        {formErrors.branchId && (
                            <p className="mt-1 text-xs text-red-600">
                                {formErrors.branchId}
                            </p>
                        )}

                        {!lookupsLoading && branches.length === 0 && (
                            <p className="mt-1 text-xs text-amber-700">
                                No branches are available. Confirm that a
                                branch exists for your company.
                            </p>
                        )}
                    </div>

                    {/* PROCESSOR */}

                    <div>
                        <label
                            htmlFor="job-work-order-processor"
                            className="mb-1.5 block text-sm font-medium text-navy-700"
                        >
                            External Processor{' '}
                            <span className="text-red-500">*</span>
                        </label>

                        <select
                            id="job-work-order-processor"
                            className="input-field w-full"
                            value={form.externalProcessorId}
                            onChange={(event) =>
                                handleFormChange(
                                    'externalProcessorId',
                                    event.target.value
                                )
                            }
                            disabled={lookupsLoading}
                            required
                        >
                            <option value="">
                                {lookupsLoading
                                    ? 'Loading processors...'
                                    : 'Select external processor'}
                            </option>

                            {processors.map((processor) => (
                                <option
                                    key={processor.externalProcessorId}
                                    value={processor.externalProcessorId}
                                >
                                    {processor.processorCode
                                        ? `${processor.name} (${processor.processorCode})`
                                        : processor.name}
                                </option>
                            ))}
                        </select>

                        {formErrors.externalProcessorId && (
                            <p className="mt-1 text-xs text-red-600">
                                {formErrors.externalProcessorId}
                            </p>
                        )}

                        {!lookupsLoading && processors.length === 0 && (
                            <p className="mt-1 text-xs text-amber-700">
                                Add or activate an external processor before
                                creating a job order.
                            </p>
                        )}
                    </div>

                    {/* PROCESS TYPE */}

                    <div>
                        <label
                            htmlFor="job-work-order-process-type"
                            className="mb-1.5 block text-sm font-medium text-navy-700"
                        >
                            Processing Type{' '}
                            <span className="text-red-500">*</span>
                        </label>

                        <select
                            id="job-work-order-process-type"
                            className="input-field w-full"
                            value={form.processTypeId}
                            onChange={(event) =>
                                handleFormChange(
                                    'processTypeId',
                                    event.target.value
                                )
                            }
                            disabled={lookupsLoading}
                            required
                        >
                            <option value="">
                                {lookupsLoading
                                    ? 'Loading processing types...'
                                    : 'Select processing type'}
                            </option>

                            {processTypes.map((processType) => (
                                <option
                                    key={processType.processTypeId}
                                    value={processType.processTypeId}
                                >
                                    {processType.code
                                        ? `${processType.name} (${processType.code})`
                                        : processType.name}
                                </option>
                            ))}
                        </select>

                        {formErrors.processTypeId && (
                            <p className="mt-1 text-xs text-red-600">
                                {formErrors.processTypeId}
                            </p>
                        )}

                        {!lookupsLoading && processTypes.length === 0 && (
                            <p className="mt-1 text-xs text-amber-700">
                                Add or activate a processing type before
                                creating a job order.
                            </p>
                        )}
                    </div>

                    {/* MONTHLY RATE PREVIEW */}

                    {form.processTypeId && form.orderDate && (
                        <div className="rounded-xl border border-navy-100 bg-navy-50 p-4">
                            <p className="text-sm font-semibold text-navy-800">
                                Monthly Rate Reference
                            </p>

                            <p className="mt-1 text-xs text-navy-600">
                                Applicable month:{' '}
                                {getMonthFromDate(form.orderDate) || '—'}
                            </p>

                            {ratePreviewLoading ? (
                                <p className="mt-2 text-sm text-navy-600">
                                    Loading the configured rate...
                                </p>
                            ) : ratePreviewFailed ? (
                                <p className="mt-2 text-sm text-amber-700">
                                    The rate preview could not be loaded.
                                    The order API will apply the available
                                    rate for the order month when creating
                                    the order.
                                </p>
                            ) : ratePreview ? (
                                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <span className="text-lg font-semibold text-navy-900">
                                        {formatCurrency(ratePreview.rate)}
                                    </span>

                                    <span className="text-sm text-navy-600">
                                        {getChargeUnitLabel(ratePreview.chargeUnit)}
                                    </span>
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-amber-700">
                                    No monthly rate was found for this
                                    processing type and month. Configure the
                                    rate in Monthly Processing Rates if a
                                    quotation reference is required.
                                </p>
                            )}

                            <p className="mt-2 text-xs text-navy-500">
                                This is a reference only. The backend stores
                                the applicable monthly rate on the order
                                when available.
                            </p>
                        </div>
                    )}

                    {/* DESCRIPTION */}

                    <div>
                        <label
                            htmlFor="job-work-order-description"
                            className="mb-1.5 block text-sm font-medium text-navy-700"
                        >
                            Description
                        </label>

                        <textarea
                            id="job-work-order-description"
                            className="input-field min-h-[85px] w-full"
                            maxLength={10000}
                            value={form.description}
                            onChange={(event) =>
                                handleFormChange(
                                    'description',
                                    event.target.value
                                )
                            }
                            placeholder="Describe the work assigned, specifications or instructions..."
                        />

                        {formErrors.description && (
                            <p className="mt-1 text-xs text-red-600">
                                {formErrors.description}
                            </p>
                        )}
                    </div>

                    {/* NOTES */}

                    <div>
                        <label
                            htmlFor="job-work-order-notes"
                            className="mb-1.5 block text-sm font-medium text-navy-700"
                        >
                            Internal Notes
                        </label>

                        <textarea
                            id="job-work-order-notes"
                            className="input-field min-h-[75px] w-full"
                            maxLength={10000}
                            value={form.notes}
                            onChange={(event) =>
                                handleFormChange('notes', event.target.value)
                            }
                            placeholder="Optional notes for internal reference..."
                        />

                        {formErrors.notes && (
                            <p className="mt-1 text-xs text-red-600">
                                {formErrors.notes}
                            </p>
                        )}
                    </div>

                    {formErrors.form && (
                        <p className="text-sm text-red-600">
                            {formErrors.form}
                        </p>
                    )}

                    {/* ACTIONS */}

                    <div className="flex flex-col-reverse gap-2 border-t border-navy-100 pt-4 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 transition hover:bg-navy-50"
                            onClick={closeCreateModal}
                            disabled={saving}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={
                                saving ||
                                lookupsLoading ||
                                branches.length === 0 ||
                                processors.length === 0 ||
                                processTypes.length === 0
                            }
                        >
                            {saving ? 'Creating...' : 'Create Job Order'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ORDER DETAILS MODAL */}

            <Modal
                open={detailsModalOpen}
                onClose={closeDetailsModal}
                title={
                    selectedOrder?.jobNumber
                        ? `Job Order: ${selectedOrder.jobNumber}`
                        : 'Job Order Details'
                }
                size="lg"
            >
                {detailsLoading && !selectedOrder ? (
                    <div className="p-6 text-center text-sm text-navy-500">
                        Loading order details...
                    </div>
                ) : selectedOrder ? (
                    <div className="space-y-5">
                        {detailsLoading && (
                            <p className="text-xs text-navy-500">
                                Refreshing order details...
                            </p>
                        )}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <DetailField
                                label="Job Number"
                                value={selectedOrder.jobNumber}
                            />

                            <DetailField
                                label="Order Date"
                                value={formatDate(selectedOrder.orderDate)}
                            />

                            <DetailField
                                label="Branch"
                                value={
                                    selectedOrder.branch?.branchName || '—'
                                }
                            />

                            <DetailField
                                label="External Processor"
                                value={
                                    selectedOrder.externalProcessor?.name || '—'
                                }
                            />

                            <DetailField
                                label="Processing Type"
                                value={
                                    selectedOrder.processType?.name || '—'
                                }
                            />

                            <DetailField
                                label="Status"
                                value={getStatusLabel(selectedOrder.status)}
                            />

                            <DetailField
                                label="Quoted Rate"
                                value={getQuoteAmount(selectedOrder)}
                            />

                            <DetailField
                                label="Quoted Charge Unit"
                                value={getChargeUnitLabel(
                                    selectedOrder.quotedChargeUnit
                                )}
                            />

                            <DetailField
                                label="Rate Month"
                                value={
                                    formatDate(selectedOrder.quotedRateMonth)
                                }
                            />

                            <DetailField
                                label="Dispatches"
                                value={
                                    Array.isArray(selectedOrder.dispatches)
                                        ? selectedOrder.dispatches.length
                                        : 'Not loaded'
                                }
                            />
                        </div>

                        {selectedOrder.description && (
                            <div className="rounded-lg border border-navy-100 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">
                                    Description
                                </p>

                                <p className="mt-1 whitespace-pre-wrap text-sm text-navy-800">
                                    {selectedOrder.description}
                                </p>
                            </div>
                        )}

                        {selectedOrder.notes && (
                            <div className="rounded-lg border border-navy-100 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">
                                    Internal Notes
                                </p>

                                <p className="mt-1 whitespace-pre-wrap text-sm text-navy-800">
                                    {selectedOrder.notes}
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end border-t border-navy-100 pt-4">
                            <button
                                type="button"
                                className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 transition hover:bg-navy-50"
                                onClick={closeDetailsModal}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-center text-sm text-navy-500">
                        No order details are available.
                    </div>
                )}
            </Modal>
        </div>
    );
}

// ============================================================
// ORDER DETAILS FIELD
// ============================================================

function DetailField({ label, value }) {
    return (
        <div className="rounded-lg border border-navy-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">
                {label}
            </p>

            <p className="mt-1 break-words text-sm font-medium text-navy-900">
                {value || '—'}
            </p>
        </div>
    );
}