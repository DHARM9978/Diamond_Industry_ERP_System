
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    CheckCircle2,
    CircleDollarSign,
    ClipboardList,
    Pencil,
    Plus,
    Power,
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
// CONSTANTS
// ============================================================

const PROCESS_TYPES_ENDPOINT = '/api/job-work/process-types';

const EMPTY_FORM = {
    code: '',
    name: '',
    description: '',
    chargeUnit: '',
    defaultRate: '',
};

const CHARGE_UNITS = [
    { value: 'PER_CARAT', label: 'Per carat' },
    { value: 'PER_PIECE', label: 'Per piece' },
    { value: 'PER_GRAM', label: 'Per gram' },
    { value: 'PER_JOB', label: 'Per job / fixed job charge' },
];

// ============================================================
// HELPERS
// ============================================================

const normalizeText = (value) => String(value ?? '').trim();

const normalizeCode = (value) => normalizeText(value).toUpperCase();

const normalizeName = (value) => normalizeText(value);

const getErrorMessage = (error, fallback) => (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
);

const getChargeUnitLabel = (value) => (
    CHARGE_UNITS.find((unit) => unit.value === value)?.label ||
    (value ? String(value).replaceAll('_', ' ').toLowerCase() : 'Not specified')
);

const formatRate = (value) => {
    if (value === null || value === undefined || value === '') {
        return 'Not set';
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 'Not set';
    }

    return `₹${number.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const normalizeProcessType = (processType) => ({
    ...processType,
    isActive: Boolean(processType.isActive),
});

// ============================================================
// ADMIN JOB WORK PROCESS TYPES
// ============================================================

export function AdminJobWorkProcessTypes() {
    const { toast } = useToast();

    // ----------------------------------------------------------
    // DATA AND UI STATE
    // ----------------------------------------------------------

    const [processTypes, setProcessTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formVersion, setFormVersion] = useState(0);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // ----------------------------------------------------------
    // LOAD PROCESSING TYPES FROM THE DATABASE
    // ----------------------------------------------------------

    const loadProcessTypes = useCallback(async ({ showError = true } = {}) => {
        setLoading(true);

        try {
            const response = await apiClient.get(PROCESS_TYPES_ENDPOINT);
            const records = response?.data?.data;

            if (!Array.isArray(records)) {
                throw new Error(
                    'The server returned an invalid processing type list.'
                );
            }

            setProcessTypes(records.map(normalizeProcessType));

            return records;
        } catch (error) {
            if (showError) {
                toast(
                    getErrorMessage(
                        error,
                        'Unable to load processing types.'
                    ),
                    'error'
                );
            }

            throw error;
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        let cancelled = false;

        const initialize = async () => {
            try {
                const response = await apiClient.get(PROCESS_TYPES_ENDPOINT);
                const records = response?.data?.data;

                if (!Array.isArray(records)) {
                    throw new Error(
                        'The server returned an invalid processing type list.'
                    );
                }

                if (!cancelled) {
                    setProcessTypes(records.map(normalizeProcessType));
                }
            } catch (error) {
                if (!cancelled) {
                    toast(
                        getErrorMessage(
                            error,
                            'Unable to load processing types.'
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

        initialize();

        return () => {
            cancelled = true;
        };
    }, [toast]);

    // ----------------------------------------------------------
    // FILTERED DATA
    // ----------------------------------------------------------

    const filteredProcessTypes = useMemo(() => {
        const term = search.trim().toLowerCase();

        return processTypes.filter((processType) => {
            const searchableValues = [
                processType.code,
                processType.name,
                processType.description,
                processType.chargeUnit,
            ];

            const matchesSearch =
                !term ||
                searchableValues.some((value) =>
                    String(value ?? '').toLowerCase().includes(term)
                );

            const matchesStatus =
                !statusFilter ||
                (statusFilter === 'ACTIVE' && processType.isActive) ||
                (statusFilter === 'INACTIVE' && !processType.isActive);

            return matchesSearch && matchesStatus;
        });
    }, [processTypes, search, statusFilter]);

    const activeCount = processTypes.filter(
        (processType) => processType.isActive
    ).length;

    const inactiveCount = processTypes.length - activeCount;

    // ----------------------------------------------------------
    // OPEN ADD / EDIT FORM
    // ----------------------------------------------------------

    const handleAdd = () => {
        setEditing(null);
        setFormVersion((value) => value + 1);
        setModalOpen(true);
    };

    const handleEdit = (processType) => {
        setEditing(processType);
        setFormVersion((value) => value + 1);
        setModalOpen(true);
    };

    const closeModal = () => {
        if (saving) {
            return;
        }

        setModalOpen(false);
        setEditing(null);
    };

    // ----------------------------------------------------------
    // CREATE / UPDATE THROUGH THE BACKEND
    // ----------------------------------------------------------

    const handleSave = async (formData) => {
        try {
            setSaving(true);

            const payload = {
                code: normalizeCode(formData.code),
                name: normalizeName(formData.name),
                description: normalizeText(formData.description) || null,
                chargeUnit: formData.chargeUnit || null,
                defaultRate:
                    formData.defaultRate === ''
                        ? null
                        : Number(formData.defaultRate),
            };

            // Fast frontend duplicate checks.
            // The database unique constraints remain authoritative.
            const duplicateCode = processTypes.some(
                (processType) =>
                    processType.code?.toUpperCase() === payload.code &&
                    processType.processTypeId !== editing?.processTypeId
            );

            if (duplicateCode) {
                throw new Error(
                    'This processing type code already exists.'
                );
            }

            const duplicateName = processTypes.some(
                (processType) =>
                    processType.name?.trim().toLowerCase() ===
                        payload.name.toLowerCase() &&
                    processType.processTypeId !== editing?.processTypeId
            );

            if (duplicateName) {
                throw new Error(
                    'This processing type name already exists.'
                );
            }

            const response = editing
                ? await apiClient.patch(
                    `${PROCESS_TYPES_ENDPOINT}/${editing.processTypeId}`,
                    payload
                )
                : await apiClient.post(
                    PROCESS_TYPES_ENDPOINT,
                    payload
                );

            // Use the response from the persisted database record.
            const savedProcessType = response?.data?.data;

            if (!savedProcessType?.processTypeId) {
                throw new Error(
                    'The server did not return the saved processing type.'
                );
            }

            const normalizedRecord = normalizeProcessType(savedProcessType);

            setProcessTypes((previous) => {
                if (editing) {
                    return previous.map((item) =>
                        item.processTypeId === normalizedRecord.processTypeId
                            ? normalizedRecord
                            : item
                    );
                }

                return [
                    normalizedRecord,
                    ...previous.filter(
                        (item) =>
                            item.processTypeId !== normalizedRecord.processTypeId
                    ),
                ];
            });

            setModalOpen(false);
            setEditing(null);

            toast(
                response?.data?.message ||
                    (editing
                        ? 'Processing type updated successfully.'
                        : 'Processing type created successfully.'),
                'success'
            );

            // Confirm the list against the backend after saving.
            try {
                await loadProcessTypes({ showError: true });
            } catch {
                // The save succeeded; the loader has already displayed
                // its own error if refreshing the list failed.
            }
        } catch (error) {
            toast(
                getErrorMessage(
                    error,
                    'Unable to save processing type.'
                ),
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    // ----------------------------------------------------------
    // ACTIVATE / DEACTIVATE THROUGH THE BACKEND
    // ----------------------------------------------------------

    const handleToggleStatus = async (processType) => {
        const status = processType.isActive ? 'INACTIVE' : 'ACTIVE';

        try {
            setSaving(true);

            const response = await apiClient.patch(
                `${PROCESS_TYPES_ENDPOINT}/${processType.processTypeId}/status`,
                { status }
            );

            const savedProcessType = response?.data?.data;

            if (!savedProcessType?.processTypeId) {
                throw new Error(
                    'The server did not return the updated processing type.'
                );
            }

            const normalizedRecord = normalizeProcessType(savedProcessType);

            setProcessTypes((previous) =>
                previous.map((item) =>
                    item.processTypeId === normalizedRecord.processTypeId
                        ? normalizedRecord
                        : item
                )
            );

            toast(
                response?.data?.message ||
                    `Processing type ${status.toLowerCase()} successfully.`,
                'success'
            );

            try {
                await loadProcessTypes({ showError: true });
            } catch {
                // The status update succeeded; the loader reports its
                // own error if the refreshed list cannot be retrieved.
            }
        } catch (error) {
            toast(
                getErrorMessage(
                    error,
                    'Unable to update processing type status.'
                ),
                'error'
            );
        } finally {
            setSaving(false);
        }
    };

    // ----------------------------------------------------------
    // TABLE COLUMNS
    // ----------------------------------------------------------

    const columns = [
        {
            key: 'code',
            label: 'Process Code',
            render: (processType) => (
                <span className="font-mono text-xs font-semibold text-navy-700">
                    {processType.code || '—'}
                </span>
            ),
        },
        {
            key: 'name',
            label: 'Processing Type',
            render: (processType) => (
                <div className="min-w-[150px]">
                    <p className="font-medium text-navy-900">
                        {processType.name || '—'}
                    </p>

                    {processType.description && (
                        <p className="mt-0.5 max-w-sm text-xs text-navy-500">
                            {processType.description}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'chargeUnit',
            label: 'Charge Unit',
            render: (processType) => (
                <span className="text-sm text-navy-700">
                    {getChargeUnitLabel(processType.chargeUnit)}
                </span>
            ),
        },
        {
            key: 'defaultRate',
            label: 'Default Rate',
            render: (processType) => (
                <div>
                    <p className="font-medium text-navy-800">
                        {formatRate(processType.defaultRate)}
                    </p>

                    {processType.defaultRate !== null &&
                        processType.defaultRate !== undefined &&
                        processType.defaultRate !== '' && (
                            <p className="mt-0.5 text-xs text-navy-500">
                                {getChargeUnitLabel(processType.chargeUnit)}
                            </p>
                        )}
                </div>
            ),
        },
        {
            key: 'isActive',
            label: 'Status',
            align: 'center',
            render: (processType) => (
                <span
                    className={
                        processType.isActive
                            ? 'inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-xs font-semibold text-success-700'
                            : 'inline-flex items-center gap-1.5 rounded-full bg-navy-100 px-2.5 py-1 text-xs font-semibold text-navy-600'
                    }
                >
                    {processType.isActive && <CheckCircle2 size={12} />}
                    {processType.isActive ? 'Active' : 'Inactive'}
                </span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (processType) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => handleEdit(processType)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Pencil size={14} />
                        Edit
                    </button>

                    <button
                        type="button"
                        onClick={() => handleToggleStatus(processType)}
                        disabled={saving}
                        className={
                            processType.isActive
                                ? 'inline-flex items-center gap-1.5 rounded-lg border border-warning-200 px-3 py-1.5 text-xs font-medium text-warning-700 transition-colors hover:bg-warning-50 disabled:cursor-not-allowed disabled:opacity-50'
                                : 'inline-flex items-center gap-1.5 rounded-lg border border-success-200 px-3 py-1.5 text-xs font-medium text-success-700 transition-colors hover:bg-success-50 disabled:cursor-not-allowed disabled:opacity-50'
                        }
                    >
                        <Power size={14} />
                        {processType.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            ),
        },
    ];

    // ----------------------------------------------------------
    // PAGE
    // ----------------------------------------------------------

    return (
        <div className="space-y-6">
            <PageHeader
                title="Processing Type Master"
                subtitle={`${processTypes.length} type${processTypes.length === 1 ? '' : 's'} · ${activeCount} active · ${inactiveCount} inactive`}
                actions={
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleAdd}
                        disabled={saving}
                    >
                        <Plus size={18} />
                        Add Processing Type
                    </button>
                }
            />

            {/* SEARCH AND STATUS FILTER */}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-sm">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Search process code, name or charge unit..."
                    />
                </div>

                <div className="flex items-center gap-2">
                    <label
                        htmlFor="job-work-process-type-status-filter"
                        className="text-sm font-medium text-navy-700"
                    >
                        Status
                    </label>

                    <select
                        id="job-work-process-type-status-filter"
                        className="input-field min-w-[150px]"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <option value="">All statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                </div>
            </div>

            {/* PROCESSING TYPE LIST */}

            {loading && processTypes.length === 0 ? (
                <div className="rounded-xl border border-navy-100 bg-white p-8 text-center text-sm text-navy-500">
                    Loading processing types...
                </div>
            ) : filteredProcessTypes.length === 0 ? (
                <EmptyState
                    icon={search.trim() || statusFilter ? Search : ClipboardList}
                    title={
                        processTypes.length === 0
                            ? 'No processing types yet'
                            : 'No matching processing types'
                    }
                    message={
                        processTypes.length === 0
                            ? 'Add the processing operations your company sends to external processors, such as polishing or bruting.'
                            : 'Try a different search term or status filter.'
                    }
                    action={
                        processTypes.length === 0 &&
                        !search.trim() &&
                        !statusFilter ? (
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleAdd}
                                disabled={saving}
                            >
                                <Plus size={17} />
                                Add Processing Type
                            </button>
                        ) : undefined
                    }
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={filteredProcessTypes}
                    emptyMessage="No processing types found."
                />
            )}

            {/* ADD / EDIT MODAL */}

            <Modal
                open={modalOpen}
                onClose={closeModal}
                title={editing ? 'Edit Processing Type' : 'Add Processing Type'}
                size="lg"
            >
                <JobWorkProcessTypeForm
                    key={formVersion}
                    editing={editing}
                    processTypes={processTypes}
                    saving={saving}
                    onCancel={closeModal}
                    onSave={handleSave}
                />
            </Modal>
        </div>
    );
}

// ============================================================
// PROCESSING TYPE FORM
// ============================================================

function JobWorkProcessTypeForm({
    editing,
    processTypes,
    saving,
    onCancel,
    onSave,
}) {
    const [form, setForm] = useState({
        ...EMPTY_FORM,
        code: editing?.code || '',
        name: editing?.name || '',
        description: editing?.description || '',
        chargeUnit: editing?.chargeUnit || '',
        defaultRate:
            editing?.defaultRate === null ||
            editing?.defaultRate === undefined
                ? ''
                : String(editing.defaultRate),
    });

    const [errors, setErrors] = useState({});

    // ----------------------------------------------------------
    // FIELD HANDLER
    // ----------------------------------------------------------

    const handleChange = (field, value) => {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));

        setErrors((previous) => ({
            ...previous,
            [field]: '',
            form: '',
        }));
    };

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    const validate = () => {
        const nextErrors = {};

        const code = normalizeCode(form.code);
        const name = normalizeName(form.name);
        const description = normalizeText(form.description);
        const rateText = normalizeText(form.defaultRate);

        if (!code) {
            nextErrors.code = 'Process code is required.';
        } else if (code.length > 30) {
            nextErrors.code = 'Process code cannot exceed 30 characters.';
        } else if (!/^[A-Z0-9_-]+$/.test(code)) {
            nextErrors.code =
                'Use only letters, numbers, hyphens or underscores.';
        }

        if (!name) {
            nextErrors.name = 'Processing type name is required.';
        } else if (name.length > 100) {
            nextErrors.name =
                'Processing type name cannot exceed 100 characters.';
        }

        if (description.length > 5000) {
            nextErrors.description =
                'Description cannot exceed 5,000 characters.';
        }

        if (rateText) {
            if (!/^\d+(\.\d{1,2})?$/.test(rateText)) {
                nextErrors.defaultRate =
                    'Enter a non-negative rate with up to 2 decimal places.';
            } else {
                const rate = Number(rateText);

                if (!Number.isFinite(rate) || rate > 9999999999.99) {
                    nextErrors.defaultRate =
                        'Rate is outside the supported range.';
                }
            }

            if (!form.chargeUnit) {
                nextErrors.chargeUnit =
                    'Select a charge unit when entering a default rate.';
            }
        }

        const duplicateCode = processTypes.some(
            (processType) =>
                processType.code?.toUpperCase() === code &&
                processType.processTypeId !== editing?.processTypeId
        );

        if (code && duplicateCode) {
            nextErrors.code = 'This process code already exists.';
        }

        const duplicateName = processTypes.some(
            (processType) =>
                processType.name?.trim().toLowerCase() === name.toLowerCase() &&
                processType.processTypeId !== editing?.processTypeId
        );

        if (name && duplicateName) {
            nextErrors.name = 'This processing type name already exists.';
        }

        setErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    };

    // ----------------------------------------------------------
    // SUBMIT
    // ----------------------------------------------------------

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!validate()) {
            return;
        }

        await onSave({
            ...form,
            code: normalizeCode(form.code),
            name: normalizeName(form.name),
            description: normalizeText(form.description),
            chargeUnit: form.chargeUnit,
            defaultRate: normalizeText(form.defaultRate),
        });
    };

    const renderError = (field) => (
        errors[field] ? (
            <span className="text-xs text-error-700">
                {errors[field]}
            </span>
        ) : null
    );

    // ----------------------------------------------------------
    // FORM UI
    // ----------------------------------------------------------

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {errors.form && (
                <div className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">
                    {errors.form}
                </div>
            )}

            {/* BASIC DETAILS */}

            <div>
                <h3 className="mb-3 text-sm font-semibold text-navy-900">
                    Processing Details
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="job-work-process-code"
                            className="text-sm font-medium text-navy-700"
                        >
                            Process Code <span className="text-error-500">*</span>
                        </label>

                        <input
                            id="job-work-process-code"
                            type="text"
                            className="input-field uppercase"
                            value={form.code}
                            onChange={(event) =>
                                handleChange(
                                    'code',
                                    event.target.value.toUpperCase()
                                )
                            }
                            maxLength={30}
                            placeholder="e.g. POLISH"
                            required
                            disabled={saving}
                        />

                        {renderError('code')}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="job-work-process-name"
                            className="text-sm font-medium text-navy-700"
                        >
                            Processing Type Name <span className="text-error-500">*</span>
                        </label>

                        <input
                            id="job-work-process-name"
                            type="text"
                            className="input-field"
                            value={form.name}
                            onChange={(event) =>
                                handleChange('name', event.target.value)
                            }
                            maxLength={100}
                            placeholder="e.g. Diamond Polishing"
                            required
                            disabled={saving}
                        />

                        {renderError('name')}
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label
                            htmlFor="job-work-process-description"
                            className="text-sm font-medium text-navy-700"
                        >
                            Description
                        </label>

                        <textarea
                            id="job-work-process-description"
                            className="input-field min-h-[90px] resize-y"
                            value={form.description}
                            onChange={(event) =>
                                handleChange('description', event.target.value)
                            }
                            maxLength={5000}
                            placeholder="Describe what this processing type covers"
                            disabled={saving}
                        />

                        <div className="flex items-center justify-between gap-3">
                            {renderError('description')}

                            <span className="ml-auto text-xs text-navy-400">
                                {form.description.length}/5000
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* RATE CONFIGURATION */}

            <div className="border-t border-navy-100 pt-4">
                <div className="mb-3 flex items-start gap-2">
                    <CircleDollarSign size={18} className="mt-0.5 text-navy-500" />

                    <div>
                        <h3 className="text-sm font-semibold text-navy-900">
                            Default Processing Rate
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-navy-500">
                            Optional reference rate. It does not automatically
                            calculate the final job-work bill.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="job-work-charge-unit"
                            className="text-sm font-medium text-navy-700"
                        >
                            Charge Unit
                        </label>

                        <select
                            id="job-work-charge-unit"
                            className="input-field"
                            value={form.chargeUnit}
                            onChange={(event) =>
                                handleChange('chargeUnit', event.target.value)
                            }
                            disabled={saving}
                        >
                            <option value="">Not specified</option>

                            {CHARGE_UNITS.map((unit) => (
                                <option key={unit.value} value={unit.value}>
                                    {unit.label}
                                </option>
                            ))}
                        </select>

                        {renderError('chargeUnit')}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="job-work-default-rate"
                            className="text-sm font-medium text-navy-700"
                        >
                            Default Rate (₹)
                        </label>

                        <input
                            id="job-work-default-rate"
                            type="number"
                            className="input-field"
                            value={form.defaultRate}
                            onChange={(event) =>
                                handleChange('defaultRate', event.target.value)
                            }
                            min="0"
                            max="9999999999.99"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="Leave blank if not set"
                            disabled={saving}
                        />

                        {renderError('defaultRate')}
                    </div>
                </div>

                <p className="mt-3 text-xs leading-5 text-navy-500">
                    Carats and grams remain separate measurements in job-work
                    records. This screen does not perform unit conversion.
                </p>
            </div>

            {/* FORM ACTIONS */}

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
                    {saving
                        ? 'Saving...'
                        : editing
                            ? 'Update Processing Type'
                            : 'Add Processing Type'}
                </button>
            </div>
        </form>
    );
}
