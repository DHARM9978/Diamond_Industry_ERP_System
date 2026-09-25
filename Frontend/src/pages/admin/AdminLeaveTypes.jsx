import { useEffect, useMemo, useState } from 'react';

import {
    Check,
    Edit,
    Plus,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-react';

import {
    PageHeader,
    DataTable,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/Form';
import { useToast } from '@/context/ToastContext';

import { leaveTypeService } from '@/services/apiServices';

// ============================================================
// HELPERS
// ============================================================

const getErrorMessage = (error, fallback) => {
    return (
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        fallback
    );
};

const normalizeLeaveTypesResponse = (response) => {
    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response?.data)) {
        return response.data;
    }

    if (Array.isArray(response?.data?.data)) {
        return response.data.data;
    }

    return [];
};

const formatQuota = (value) => {
    if (value === null || value === undefined || value === '') {
        return '--';
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return '--';
    }

    return Number.isInteger(number)
        ? String(number)
        : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const isSystemDefault = (leaveType) => {
    return leaveType?.isSystemDefault === true;
};

const getConfiguredLeaveTypes = (leaveTypes) => {
    return leaveTypes.filter(
        (leaveType) => !isSystemDefault(leaveType)
    );
};

// ============================================================
// ADMIN LEAVE TYPES
// ============================================================

export function AdminLeaveTypes() {
    const { toast } = useToast();

    const [leaveTypes, setLeaveTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const [search, setSearch] = useState('');
    const [error, setError] = useState('');

    // ==========================================================
    // LOAD LEAVE TYPES
    // ==========================================================

    const loadLeaveTypes = async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError('');

            const response = await leaveTypeService.list();
            const data = normalizeLeaveTypesResponse(response);

            setLeaveTypes(data);
        } catch (err) {
            console.error('Failed to load leave types:', err);

            const message = getErrorMessage(
                err,
                'Failed to load leave types'
            );

            setError(message);
            setLeaveTypes([]);

            toast(message, 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadLeaveTypes();
    }, []);

    // ==========================================================
    // DERIVED DATA
    // ==========================================================

    const configuredLeaveTypes = useMemo(() => {
        const configured = getConfiguredLeaveTypes(leaveTypes);
        const searchValue = search.trim().toLowerCase();

        if (!searchValue) {
            return configured;
        }

        return configured.filter((leaveType) => {
            return (
                leaveType?.name
                    ?.toLowerCase()
                    .includes(searchValue) ||
                leaveType?.code
                    ?.toLowerCase()
                    .includes(searchValue) ||
                leaveType?.description
                    ?.toLowerCase()
                    .includes(searchValue)
            );
        });
    }, [leaveTypes, search]);

    const totalConfigured = getConfiguredLeaveTypes(
        leaveTypes
    ).length;

    const systemDefaultExists = leaveTypes.some(
        (leaveType) => isSystemDefault(leaveType)
    );

    // ==========================================================
    // ADD
    // ==========================================================

    const handleAdd = () => {
        setEditing(null);
        setModalOpen(true);
    };

    // ==========================================================
    // EDIT
    // ==========================================================

    const handleEdit = (leaveType) => {
        if (isSystemDefault(leaveType)) {
            toast(
                'The system default Casual Leave cannot be edited here.',
                'error'
            );
            return;
        }

        setEditing(leaveType);
        setModalOpen(true);
    };

    // ==========================================================
    // DELETE
    // ==========================================================

    const handleDelete = async (leaveType) => {
        if (isSystemDefault(leaveType)) {
            toast(
                'The system default Casual Leave cannot be deleted.',
                'error'
            );
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to delete "${leaveType.name}"?`
        );

        if (!confirmed) {
            return;
        }

        try {
            setSaving(true);

            await leaveTypeService.delete(
                leaveType.leaveTypeId
            );

            toast(
                'Leave type deleted successfully',
                'success'
            );

            await loadLeaveTypes(true);
        } catch (err) {
            console.error(
                'Failed to delete leave type:',
                err
            );

            toast(
                getErrorMessage(
                    err,
                    'Failed to delete leave type'
                ),
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    // ==========================================================
    // SAVE
    // ==========================================================

    const handleSave = async (formData) => {
        try {
            setSaving(true);

            const payload = {
                name: formData.name.trim(),
                code: formData.code.trim().toUpperCase(),
                description:
                    formData.description.trim() || null,
                annualQuota: Number(formData.annualQuota),
                isPaid: formData.isPaid,
                requiresApproval: formData.requiresApproval,
                allowHalfDay: formData.allowHalfDay,
                allowCarryForward: formData.allowCarryForward,
                status: formData.status
            };

            if (!payload.name) {
                throw new Error(
                    'Leave type name is required'
                );
            }

            if (!payload.code) {
                throw new Error(
                    'Leave type code is required'
                );
            }

            if (
                !Number.isFinite(payload.annualQuota) ||
                payload.annualQuota <= 0
            ) {
                throw new Error(
                    'Annual leave limit must be greater than zero'
                );
            }

            if (editing) {
                await leaveTypeService.update(
                    editing.leaveTypeId,
                    payload
                );

                toast(
                    'Leave type updated successfully',
                    'success'
                );
            } else {
                await leaveTypeService.create(payload);

                toast(
                    'Leave type created successfully',
                    'success'
                );
            }

            await loadLeaveTypes(true);

            setModalOpen(false);
            setEditing(null);
        } catch (err) {
            console.error(
                'Failed to save leave type:',
                err
            );

            toast(
                getErrorMessage(
                    err,
                    'Failed to save leave type'
                ),
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    // ==========================================================
    // TOGGLE STATUS
    // ==========================================================

    const handleToggleStatus = async (leaveType) => {
        if (isSystemDefault(leaveType)) {
            toast(
                'The system default Casual Leave cannot be changed here.',
                'error'
            );
            return;
        }

        const nextStatus =
            leaveType.status === 'ACTIVE'
                ? 'INACTIVE'
                : 'ACTIVE';

        try {
            setSaving(true);

            await leaveTypeService.update(
                leaveType.leaveTypeId,
                {
                    status: nextStatus
                }
            );

            toast(
                nextStatus === 'ACTIVE'
                    ? 'Leave type activated successfully'
                    : 'Leave type deactivated successfully',
                'success'
            );

            await loadLeaveTypes(true);
        } catch (err) {
            console.error(
                'Failed to change leave type status:',
                err
            );

            toast(
                getErrorMessage(
                    err,
                    'Failed to change leave type status'
                ),
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    // ==========================================================
    // TABLE COLUMNS
    // ==========================================================

    const columns = [
        {
            key: 'name',
            label: 'Leave Type',
            render: (leaveType) => (
                <div>
                    <p className="font-medium text-navy-900">
                        {leaveType.name}
                    </p>

                    {leaveType.description && (
                        <p className="mt-0.5 text-xs text-navy-500">
                            {leaveType.description}
                        </p>
                    )}
                </div>
            )
        },
        {
            key: 'code',
            label: 'Code',
            render: (leaveType) => (
                <span className="font-mono text-xs font-semibold text-navy-700">
                    {leaveType.code}
                </span>
            )
        },
        {
            key: 'annualQuota',
            label: 'Annual Limit',
            align: 'center',
            render: (leaveType) => (
                <span className="font-semibold text-navy-800">
                    {formatQuota(leaveType.annualQuota)}
                </span>
            )
        },
        {
            key: 'isPaid',
            label: 'Paid',
            align: 'center',
            render: (leaveType) =>
                leaveType.isPaid ? (
                    <Check
                        size={18}
                        className="mx-auto text-success-600"
                    />
                ) : (
                    <X
                        size={18}
                        className="mx-auto text-error-500"
                    />
                )
        },
        {
            key: 'status',
            label: 'Status',
            align: 'center',
            render: (leaveType) => (
                <span
                    className={
                        leaveType.status === 'ACTIVE'
                            ? 'inline-flex items-center rounded-full bg-success-100 px-2.5 py-1 text-xs font-semibold text-success-700'
                            : 'inline-flex items-center rounded-full bg-navy-100 px-2.5 py-1 text-xs font-semibold text-navy-600'
                    }
                >
                    {leaveType.status === 'ACTIVE'
                        ? 'Active'
                        : 'Inactive'}
                </span>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (leaveType) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            handleEdit(leaveType)
                        }
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Edit size={15} />
                        Edit
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            handleToggleStatus(leaveType)
                        }
                        disabled={saving}
                        className={
                            leaveType.status === 'ACTIVE'
                                ? 'inline-flex items-center gap-1.5 rounded-lg border border-warning-200 px-3 py-1.5 text-xs font-medium text-warning-700 transition-colors hover:bg-warning-50 disabled:cursor-not-allowed disabled:opacity-50'
                                : 'inline-flex items-center gap-1.5 rounded-lg border border-success-200 px-3 py-1.5 text-xs font-medium text-success-700 transition-colors hover:bg-success-50 disabled:cursor-not-allowed disabled:opacity-50'
                        }
                    >
                        {leaveType.status === 'ACTIVE'
                            ? 'Deactivate'
                            : 'Activate'}
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            handleDelete(leaveType)
                        }
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-error-200 px-3 py-1.5 text-xs font-medium text-error-700 transition-colors hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Trash2 size={15} />
                        Delete
                    </button>
                </div>
            )
        }
    ];

    // ==========================================================
    // LOADING
    // ==========================================================

    if (loading) {
        return (
            <FullPageSpinner
                message="Loading leave types..."
            />
        );
    }

    // ==========================================================
    // PAGE
    // ==========================================================

    return (
        <div className="space-y-6">
            <PageHeader
                title="Leave Types"
                subtitle={`${totalConfigured} configured leave type${
                    totalConfigured === 1 ? '' : 's'
                }`}
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                                loadLeaveTypes(true)
                            }
                            disabled={
                                refreshing || saving
                            }
                        >
                            <RefreshCw
                                size={18}
                                className={
                                    refreshing
                                        ? 'animate-spin'
                                        : ''
                                }
                            />
                            Refresh
                        </button>

                        <button
                            type="button"
                            className="btn-primary"
                            onClick={handleAdd}
                            disabled={saving}
                        >
                            <Plus size={18} />
                            Add Leave Type
                        </button>
                    </div>
                }
            />

            {/* ========================================================
                INFORMATION
            ======================================================== */}

            <div className="rounded-xl border border-accent-200 bg-accent-50 p-4">
                <p className="font-semibold text-accent-900">
                    Leave configuration rule
                </p>

                <p className="mt-1 text-sm leading-6 text-accent-800">
                    When no client leave type exists, employees can use
                    the system Casual Leave as an unlimited fallback.
                    As soon as you create a leave type here, that
                    fallback is hidden and employees use the limits
                    configured for these leave types.
                </p>
            </div>

            {/* ========================================================
                SEARCH
            ======================================================== */}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-sm">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Search leave type or code..."
                    />
                </div>

                {systemDefaultExists && (
                    <p className="text-xs text-navy-500">
                        System Casual Leave is managed automatically
                        and is not configurable from this page.
                    </p>
                )}
            </div>

            {/* ========================================================
                ERROR
            ======================================================== */}

            {error && (
                <div className="rounded-lg border border-error-200 bg-error-50 p-4">
                    <p className="font-medium text-error-800">
                        Unable to load leave types
                    </p>

                    <p className="mt-1 text-sm text-error-700">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            loadLeaveTypes(true)
                        }
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-error-700 px-3 py-2 text-sm font-medium text-white hover:bg-error-800"
                    >
                        <RefreshCw size={16} />
                        Retry
                    </button>
                </div>
            )}

            {/* ========================================================
                EMPTY STATE / TABLE
            ======================================================== */}

            {configuredLeaveTypes.length === 0 ? (
                search.trim() ? (
                    <EmptyState
                        icon={SearchIcon}
                        title="No matching leave types"
                        message="Try a different name or code."
                    />
                ) : (
                    <EmptyState
                        icon={Plus}
                        title="No leave types configured"
                        message="Create your first leave type to replace the unlimited system Casual Leave fallback."
                        action={
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleAdd}
                            >
                                <Plus size={17} />
                                Add Leave Type
                            </button>
                        }
                    />
                )
            ) : (
                <DataTable
                    columns={columns}
                    data={configuredLeaveTypes}
                    emptyMessage="No leave types available"
                />
            )}

            {/* ========================================================
                ADD / EDIT MODAL
            ======================================================== */}

            <Modal
                open={modalOpen}
                onClose={() => {
                    if (!saving) {
                        setModalOpen(false);
                        setEditing(null);
                    }
                }}
                title={
                    editing
                        ? 'Edit Leave Type'
                        : 'Add Leave Type'
                }
                size="lg"
            >
                <LeaveTypeForm
                    editing={editing}
                    saving={saving}
                    onCancel={() => {
                        if (!saving) {
                            setModalOpen(false);
                            setEditing(null);
                        }
                    }}
                    onSave={handleSave}
                />
            </Modal>
        </div>
    );
}

// ============================================================
// SEARCH ICON ADAPTER
// ============================================================

function SearchIcon({ size = 32, className = '' }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle
                cx="11"
                cy="11"
                r="8"
            />
            <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
            />
        </svg>
    );
}

// ============================================================
// LEAVE TYPE FORM
// ============================================================

function LeaveTypeForm({
    editing,
    saving,
    onCancel,
    onSave
}) {
    const [form, setForm] = useState({
        name: editing?.name || '',
        code: editing?.code || '',
        description: editing?.description || '',

        annualQuota:
            editing?.annualQuota !== null &&
            editing?.annualQuota !== undefined
                ? String(editing.annualQuota)
                : '',

        isPaid:
            editing?.isPaid !== undefined
                ? Boolean(editing.isPaid)
                : true,

        requiresApproval:
            editing?.requiresApproval !== undefined
                ? Boolean(editing.requiresApproval)
                : true,

        allowHalfDay:
            editing?.allowHalfDay !== undefined
                ? Boolean(editing.allowHalfDay)
                : true,

        allowCarryForward:
            editing?.allowCarryForward !== undefined
                ? Boolean(editing.allowCarryForward)
                : false,

        status:
            editing?.status || 'ACTIVE'
    });

    const [error, setError] = useState('');

    const handleChange = (field, value) => {
        setError('');

        setForm((previous) => ({
            ...previous,
            [field]: value
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        const name = form.name.trim();
        const code = form.code.trim().toUpperCase();
        const quota = Number(form.annualQuota);

        if (!name) {
            setError('Leave type name is required.');
            return;
        }

        if (!code) {
            setError('Leave type code is required.');
            return;
        }

        if (!Number.isFinite(quota) || quota <= 0) {
            setError(
                'Annual leave limit must be greater than zero.'
            );
            return;
        }

        onSave({
            ...form,
            name,
            code,
            annualQuota: quota
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-5"
        >
            {error && (
                <div className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">
                    {error}
                </div>
            )}

            {/* ====================================================
                NAME + CODE
            ===================================================== */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-navy-700">
                        Leave Type Name
                        <span className="ml-0.5 text-error-500">
                            *
                        </span>
                    </label>

                    <input
                        type="text"
                        className="input-field"
                        value={form.name}
                        onChange={(event) =>
                            handleChange(
                                'name',
                                event.target.value
                            )
                        }
                        placeholder="e.g. Sick Leave"
                        required
                        disabled={saving}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-navy-700">
                        Code
                        <span className="ml-0.5 text-error-500">
                            *
                        </span>
                    </label>

                    <input
                        type="text"
                        className="input-field uppercase"
                        value={form.code}
                        onChange={(event) =>
                            handleChange(
                                'code',
                                event.target.value.toUpperCase()
                            )
                        }
                        placeholder="e.g. SL"
                        required
                        disabled={saving}
                    />
                </div>
            </div>

            {/* ====================================================
                DESCRIPTION
            ===================================================== */}

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-navy-700">
                    Description
                </label>

                <textarea
                    className="input-field min-h-[90px] resize-y"
                    value={form.description}
                    onChange={(event) =>
                        handleChange(
                            'description',
                            event.target.value
                        )
                    }
                    placeholder="Describe when this leave can be used..."
                    disabled={saving}
                />
            </div>

            {/* ====================================================
                ANNUAL LIMIT
            ===================================================== */}

            <div className="rounded-lg border border-accent-200 bg-accent-50 p-4">
                <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-accent-900">
                        Annual Leave Limit
                        <span className="ml-0.5 text-error-500">
                            *
                        </span>
                    </span>

                    <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        className="input-field bg-white"
                        value={form.annualQuota}
                        onChange={(event) =>
                            handleChange(
                                'annualQuota',
                                event.target.value
                            )
                        }
                        placeholder="e.g. 12"
                        required
                        disabled={saving}
                    />

                    <span className="text-xs leading-5 text-accent-800">
                        This is the maximum number of leave days
                        an employee can use for this leave type
                        in one calendar year. Client-created leave
                        types cannot be unlimited.
                    </span>
                </label>
            </div>

            {/* ====================================================
                OPTIONS
            ===================================================== */}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-lg border border-navy-100 p-3">
                    <input
                        type="checkbox"
                        checked={form.isPaid}
                        onChange={(event) =>
                            handleChange(
                                'isPaid',
                                event.target.checked
                            )
                        }
                        disabled={saving}
                        className="mt-1 h-4 w-4 rounded border-navy-300 text-accent-600 focus:ring-accent-500"
                    />

                    <span>
                        <span className="block text-sm font-medium text-navy-800">
                            Paid Leave
                        </span>

                        <span className="block text-xs text-navy-500">
                            Leave days are treated as paid time off.
                        </span>
                    </span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-navy-100 p-3">
                    <input
                        type="checkbox"
                        checked={form.requiresApproval}
                        onChange={(event) =>
                            handleChange(
                                'requiresApproval',
                                event.target.checked
                            )
                        }
                        disabled={saving}
                        className="mt-1 h-4 w-4 rounded border-navy-300 text-accent-600 focus:ring-accent-500"
                    />

                    <span>
                        <span className="block text-sm font-medium text-navy-800">
                            Requires Approval
                        </span>

                        <span className="block text-xs text-navy-500">
                            Requests wait for administrator approval.
                        </span>
                    </span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-navy-100 p-3">
                    <input
                        type="checkbox"
                        checked={form.allowHalfDay}
                        onChange={(event) =>
                            handleChange(
                                'allowHalfDay',
                                event.target.checked
                            )
                        }
                        disabled={saving}
                        className="mt-1 h-4 w-4 rounded border-navy-300 text-accent-600 focus:ring-accent-500"
                    />

                    <span>
                        <span className="block text-sm font-medium text-navy-800">
                            Allow Half Day
                        </span>

                        <span className="block text-xs text-navy-500">
                            Employees can request half-day leave.
                        </span>
                    </span>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-navy-100 p-3">
                    <input
                        type="checkbox"
                        checked={form.allowCarryForward}
                        onChange={(event) =>
                            handleChange(
                                'allowCarryForward',
                                event.target.checked
                            )
                        }
                        disabled={saving}
                        className="mt-1 h-4 w-4 rounded border-navy-300 text-accent-600 focus:ring-accent-500"
                    />

                    <span>
                        <span className="block text-sm font-medium text-navy-800">
                            Allow Carry Forward
                        </span>

                        <span className="block text-xs text-navy-500">
                            Unused leave can be carried into the next year.
                        </span>
                    </span>
                </label>
            </div>

            {/* ====================================================
                STATUS
            ===================================================== */}

            {editing && (
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-navy-700">
                        Status
                    </label>

                    <select
                        className="input-field cursor-pointer"
                        value={form.status}
                        onChange={(event) =>
                            handleChange(
                                'status',
                                event.target.value
                            )
                        }
                        disabled={saving}
                    >
                        <option value="ACTIVE">
                            Active
                        </option>

                        <option value="INACTIVE">
                            Inactive
                        </option>
                    </select>
                </div>
            )}

            {/* ====================================================
                ACTIONS
            ===================================================== */}

            <div className="flex items-center justify-end gap-2 border-t border-navy-100 pt-4">
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={onCancel}
                    disabled={saving}
                >
                    Cancel
                </button>

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={saving}
                >
                    {saving && (
                        <RefreshCw
                            size={16}
                            className="animate-spin"
                        />
                    )}

                    {editing
                        ? 'Update Leave Type'
                        : 'Create Leave Type'}
                </button>
            </div>
        </form>
    );
}