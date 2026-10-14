
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    Building2,
    Mail,
    Phone,
    Plus,
    Power,
    Search,
    Pencil,
    RefreshCw,
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
// HELPERS
// ============================================================

const EMPTY_FORM = {
    processorCode: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    pan: '',
    paymentTerms: '',
    notes: '',
    status: 'ACTIVE',
};

const normalizeText = (value) =>
    String(value ?? '').trim();

const normalizeCode = (value) =>
    normalizeText(value).toUpperCase();

const EXTERNAL_PROCESSORS_ENDPOINT = '/api/job-work/processors';

const formatDate = (value) => {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    }).format(date);
};

const getErrorMessage = (error, fallback) => (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
);

// ============================================================
// ADMIN EXTERNAL PROCESSORS
// ============================================================

export function AdminExternalProcessors() {
    const { toast } = useToast();

    // ----------------------------------------------------------
    // DATA AND UI STATE
    // ----------------------------------------------------------

    // Processor records are loaded from and saved to the backend API.
    const [processors, setProcessors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formVersion, setFormVersion] = useState(0);
    const [saving, setSaving] = useState(false);
    const [statusUpdatingId, setStatusUpdatingId] = useState(null);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // ----------------------------------------------------------
    // LOAD EXTERNAL PROCESSORS FROM THE DATABASE
    // ----------------------------------------------------------

    const loadProcessors = useCallback(async ({
        showLoader = true,
        notifyError = true,
    } = {}) => {
        if (showLoader) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            setLoadError('');

            const response = await apiClient.get(
                EXTERNAL_PROCESSORS_ENDPOINT
            );

            const responseData =
                response?.data?.data ??
                response?.data ??
                response;

            const records = Array.isArray(responseData)
                ? responseData
                : Array.isArray(responseData?.processors)
                    ? responseData.processors
                    : Array.isArray(responseData?.data)
                        ? responseData.data
                        : [];

            setProcessors(records);

            return true;
        } catch (error) {
            const message = getErrorMessage(
                error,
                'Failed to load external processors. Check that the backend route is registered and the server is running.'
            );

            setLoadError(message);

            if (notifyError) {
                toast(message, 'error');
            }

            return false;
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    // ----------------------------------------------------------
    // INITIAL LOAD
    // ----------------------------------------------------------

    useEffect(() => {
        loadProcessors();
    }, [loadProcessors]);

    // ----------------------------------------------------------
    // FILTERED DATA
    // ----------------------------------------------------------

    const filteredProcessors = useMemo(() => {
        const term = search.trim().toLowerCase();

        return processors.filter((processor) => {
            const searchableValues = [
                processor.processorCode,
                processor.name,
                processor.contactPerson,
                processor.phone,
                processor.email,
                processor.gstin,
                processor.pan,
            ];

            const matchesSearch =
                !term ||
                searchableValues.some((value) =>
                    String(value ?? '').toLowerCase().includes(term)
                );

            const matchesStatus =
                !statusFilter || processor.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [processors, search, statusFilter]);

    const activeCount = processors.filter(
        (processor) => processor.status === 'ACTIVE'
    ).length;

    const inactiveCount = processors.length - activeCount;

    // ----------------------------------------------------------
    // OPEN ADD / EDIT FORM
    // ----------------------------------------------------------

    const handleAdd = () => {
        setEditing(null);
        setFormVersion((value) => value + 1);
        setModalOpen(true);
    };

    const handleEdit = (processor) => {
        setEditing(processor);
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
    // SAVE PROCESSOR TO THE BACKEND
    // ----------------------------------------------------------

    const handleSave = async (formData) => {
        try {
            setSaving(true);

            const payload = {
                processorCode: normalizeCode(formData.processorCode),
                name: normalizeText(formData.name),
                contactPerson:
                    normalizeText(formData.contactPerson) || null,
                phone: normalizeText(formData.phone) || null,
                email: normalizeText(formData.email) || null,
                address: normalizeText(formData.address) || null,
                gstin:
                    normalizeText(formData.gstin).toUpperCase() || null,
                pan:
                    normalizeText(formData.pan).toUpperCase() || null,
                paymentTerms:
                    normalizeText(formData.paymentTerms) || null,
                notes: normalizeText(formData.notes) || null,
            };

            // This provides quick feedback, while the database unique constraint
            // remains the authoritative protection against duplicate codes.
            const duplicateCode = processors.some(
                (processor) =>
                    processor.processorCode?.toUpperCase() ===
                        payload.processorCode &&
                    processor.externalProcessorId !==
                        editing?.externalProcessorId
            );

            if (duplicateCode) {
                throw new Error(
                    'This processor code already exists.'
                );
            }

            if (editing) {
                const processorId = editing.externalProcessorId;

                // Update the processor's business details.
                await apiClient.patch(
                    `${EXTERNAL_PROCESSORS_ENDPOINT}/${processorId}`,
                    payload
                );

                // Status has its own backend endpoint; use it only if the value changed.
                const nextStatus =
                    formData.status || editing.status || 'ACTIVE';

                if (nextStatus !== (editing.status || 'ACTIVE')) {
                    await apiClient.patch(
                        `${EXTERNAL_PROCESSORS_ENDPOINT}/${processorId}/status`,
                        { status: nextStatus }
                    );
                }
            } else {
                // Create a real database record through the backend.
                await apiClient.post(
                    EXTERNAL_PROCESSORS_ENDPOINT,
                    payload
                );
            }

            setModalOpen(false);
            setEditing(null);

            // Reload from the server instead of updating local state manually.
            const refreshed = await loadProcessors({
                showLoader: false,
                notifyError: false,
            });

            if (refreshed) {
                toast(
                    editing
                        ? 'External processor updated successfully.'
                        : 'External processor created successfully.',
                    'success'
                );
            } else {
                toast(
                    'The save request succeeded, but the list could not be refreshed. Use Refresh to reload the records.',
                    'warning'
                );
            }
        } catch (error) {
            // Reload the server state in case the basic details were saved but a
            // separate status update failed. The backend remains the source of truth.
            await loadProcessors({
                showLoader: false,
                notifyError: false,
            });

            toast(
                getErrorMessage(
                    error,
                    'Unable to save external processor.'
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

    const handleToggleStatus = async (processor) => {
        const processorId = processor.externalProcessorId;

        const nextStatus =
            processor.status === 'ACTIVE'
                ? 'INACTIVE'
                : 'ACTIVE';

        try {
            setStatusUpdatingId(processorId);

            await apiClient.patch(
                `${EXTERNAL_PROCESSORS_ENDPOINT}/${processorId}/status`,
                { status: nextStatus }
            );

            const refreshed = await loadProcessors({
                showLoader: false,
                notifyError: false,
            });

            if (refreshed) {
                toast(
                    nextStatus === 'ACTIVE'
                        ? 'Processor activated successfully.'
                        : 'Processor deactivated successfully.',
                    'success'
                );
            } else {
                toast(
                    'Status was updated, but the list could not be refreshed.',
                    'warning'
                );
            }
        } catch (error) {
            await loadProcessors({
                showLoader: false,
                notifyError: false,
            });

            toast(
                getErrorMessage(
                    error,
                    'Unable to change processor status.'
                ),
                'error'
            );
        } finally {
            setStatusUpdatingId(null);
        }
    };

    // ----------------------------------------------------------
    // TABLE COLUMNS
    // ----------------------------------------------------------

    const columns = [
        {
            key: 'processorCode',
            label: 'Processor Code',
            render: (processor) => (
                <span className="font-mono text-xs font-semibold text-navy-700">
                    {processor.processorCode || '—'}
                </span>
            ),
        },
        {
            key: 'name',
            label: 'External Processor',
            render: (processor) => (
                <div className="min-w-[160px]">
                    <p className="font-medium text-navy-900">
                        {processor.name || '—'}
                    </p>

                    {processor.contactPerson && (
                        <p className="mt-0.5 text-xs text-navy-500">
                            Contact: {processor.contactPerson}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'contactDetails',
            label: 'Contact Details',
            render: (processor) => (
                <div className="space-y-1 text-sm text-navy-600">
                    {processor.phone && (
                        <p className="flex items-center gap-1.5">
                            <Phone size={13} />
                            <span>{processor.phone}</span>
                        </p>
                    )}

                    {processor.email && (
                        <p className="flex items-center gap-1.5 break-all">
                            <Mail size={13} />
                            <span>{processor.email}</span>
                        </p>
                    )}

                    {!processor.phone && !processor.email && '—'}
                </div>
            ),
        },
        {
            key: 'taxDetails',
            label: 'GSTIN / PAN',
            render: (processor) => (
                <div className="space-y-1 text-xs text-navy-600">
                    <p>
                        <span className="font-medium text-navy-800">
                            GSTIN:
                        </span>{' '}
                        {processor.gstin || '—'}
                    </p>

                    <p>
                        <span className="font-medium text-navy-800">
                            PAN:
                        </span>{' '}
                        {processor.pan || '—'}
                    </p>
                </div>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            align: 'center',
            render: (processor) => (
                <span
                    className={
                        processor.status === 'ACTIVE'
                            ? 'inline-flex items-center rounded-full bg-success-100 px-2.5 py-1 text-xs font-semibold text-success-700'
                            : 'inline-flex items-center rounded-full bg-navy-100 px-2.5 py-1 text-xs font-semibold text-navy-600'
                    }
                >
                    {processor.status === 'ACTIVE'
                        ? 'Active'
                        : 'Inactive'}
                </span>
            ),
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (processor) => (
                <span className="whitespace-nowrap text-sm text-navy-600">
                    {formatDate(processor.createdAt)}
                </span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (processor) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => handleEdit(processor)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Pencil size={14} />
                        Edit
                    </button>

                    <button
                        type="button"
                        onClick={() => handleToggleStatus(processor)}
                        disabled={
                            saving ||
                            statusUpdatingId === processor.externalProcessorId
                        }
                        className={
                            processor.status === 'ACTIVE'
                                ? 'inline-flex items-center gap-1.5 rounded-lg border border-warning-200 px-3 py-1.5 text-xs font-medium text-warning-700 transition-colors hover:bg-warning-50 disabled:cursor-not-allowed disabled:opacity-50'
                                : 'inline-flex items-center gap-1.5 rounded-lg border border-success-200 px-3 py-1.5 text-xs font-medium text-success-700 transition-colors hover:bg-success-50 disabled:cursor-not-allowed disabled:opacity-50'
                        }
                    >
                        <Power size={14} />
                        {processor.status === 'ACTIVE'
                            ? 'Deactivate'
                            : 'Activate'}
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
                title="External Processors"
                subtitle={`${processors.length} processor${processors.length === 1 ? '' : 's'} · ${activeCount} active · ${inactiveCount} inactive`}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                                loadProcessors({ showLoader: false })
                            }
                            disabled={loading || refreshing || saving}
                        >
                            <RefreshCw
                                size={16}
                                className={refreshing ? 'animate-spin' : ''}
                            />
                            Refresh
                        </button>

                        <button
                            type="button"
                            className="btn-primary"
                            onClick={handleAdd}
                            disabled={saving || loading}
                        >
                            <Plus size={18} />
                            Add Processor
                        </button>
                    </div>
                }
            />

            {/* API / DATABASE ERROR */}

            {loadError && (
                <div
                    className="rounded-xl border border-error-200 bg-error-50 p-4"
                    role="alert"
                >
                    <p className="font-semibold text-error-800">
                        Unable to load external processors
                    </p>

                    <p className="mt-1 text-sm leading-6 text-error-700">
                        {loadError}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-error-700">
                        If this is a 404 error, confirm the job-work router is registered in the backend.
                    </p>
                </div>
            )}

            {/* SEARCH AND STATUS FILTER */}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-sm">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Search code, name, phone, email or GSTIN..."
                    />
                </div>

                <div className="flex items-center gap-2">
                    <label
                        htmlFor="external-processor-status-filter"
                        className="text-sm font-medium text-navy-700"
                    >
                        Status
                    </label>

                    <select
                        id="external-processor-status-filter"
                        className="input-field min-w-[150px]"
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                    >
                        <option value="">All statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                </div>
            </div>

            {/* PROCESSOR LIST */}

            {loading ? (
                <div className="flex min-h-[180px] items-center justify-center gap-3 rounded-xl border border-navy-100 bg-white text-sm text-navy-600">
                    <RefreshCw size={18} className="animate-spin" />
                    Loading external processors...
                </div>
            ) : loadError && processors.length === 0 ? (
                <EmptyState
                    icon={Building2}
                    title="External processors could not be loaded"
                    message="Check the backend server and job-work API route, then retry."
                    action={
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={() => loadProcessors()}
                            disabled={loading || refreshing}
                        >
                            <RefreshCw size={16} />
                            Retry
                        </button>
                    }
                />
            ) : filteredProcessors.length === 0 ? (
                <EmptyState
                    icon={search.trim() || statusFilter ? Search : Building2}
                    title={
                        processors.length === 0
                            ? 'No external processors yet'
                            : 'No matching processors'
                    }
                    message={
                        processors.length === 0
                            ? 'Add an external processor to start managing your diamond job-work partners.'
                            : 'Try a different search term or status filter.'
                    }
                    action={
                        processors.length === 0 &&
                        !search.trim() &&
                        !statusFilter ? (
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleAdd}
                            >
                                <Plus size={17} />
                                Add Processor
                            </button>
                        ) : undefined
                    }
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={filteredProcessors}
                    emptyMessage="No external processors found."
                />
            )}

            {/* ADD / EDIT MODAL */}

            <Modal
                open={modalOpen}
                onClose={closeModal}
                title={
                    editing
                        ? 'Edit External Processor'
                        : 'Add External Processor'
                }
                size="lg"
            >
                <ExternalProcessorForm
                    key={formVersion}
                    editing={editing}
                    processors={processors}
                    saving={saving}
                    onCancel={closeModal}
                    onSave={handleSave}
                />
            </Modal>
        </div>
    );
}

// ============================================================
// EXTERNAL PROCESSOR FORM
// ============================================================

function ExternalProcessorForm({
    editing,
    processors,
    saving,
    onCancel,
    onSave,
}) {
    const [form, setForm] = useState({
        ...EMPTY_FORM,
        processorCode: editing?.processorCode || '',
        name: editing?.name || '',
        contactPerson: editing?.contactPerson || '',
        phone: editing?.phone || '',
        email: editing?.email || '',
        address: editing?.address || '',
        gstin: editing?.gstin || '',
        pan: editing?.pan || '',
        paymentTerms: editing?.paymentTerms || '',
        notes: editing?.notes || '',
        status: editing?.status || 'ACTIVE',
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

        const code = normalizeCode(form.processorCode);
        const name = normalizeText(form.name);
        const contactPerson = normalizeText(form.contactPerson);
        const phone = normalizeText(form.phone);
        const email = normalizeText(form.email);
        const gstin = normalizeText(form.gstin).toUpperCase();
        const pan = normalizeText(form.pan).toUpperCase();
        const paymentTerms = normalizeText(form.paymentTerms);

        if (!code) {
            nextErrors.processorCode = 'Processor code is required.';
        } else if (code.length > 30) {
            nextErrors.processorCode =
                'Processor code cannot exceed 30 characters.';
        } else if (!/^[A-Z0-9_-]+$/.test(code)) {
            nextErrors.processorCode =
                'Use only letters, numbers, hyphens or underscores.';
        }

        if (!name) {
            nextErrors.name = 'Processor name is required.';
        } else if (name.length > 150) {
            nextErrors.name =
                'Processor name cannot exceed 150 characters.';
        }

        if (contactPerson.length > 100) {
            nextErrors.contactPerson =
                'Contact person cannot exceed 100 characters.';
        }

        if (phone) {
            const digits = phone.replace(/\D/g, '');

            if (!/^[0-9+()\-\s]+$/.test(phone)) {
                nextErrors.phone = 'Enter a valid phone number.';
            } else if (digits.length < 7 || digits.length > 15) {
                nextErrors.phone =
                    'Phone number must contain 7 to 15 digits.';
            }
        }

        if (email) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                nextErrors.email = 'Enter a valid email address.';
            } else if (email.length > 150) {
                nextErrors.email =
                    'Email cannot exceed 150 characters.';
            }
        }

        if (gstin && !/^[A-Z0-9]{15}$/.test(gstin)) {
            nextErrors.gstin =
                'GSTIN must contain exactly 15 letters or numbers.';
        }

        if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
            nextErrors.pan = 'Enter a valid 10-character PAN.';
        }

        if (paymentTerms.length > 100) {
            nextErrors.paymentTerms =
                'Payment terms cannot exceed 100 characters.';
        }

        const duplicateCode = processors.some(
            (processor) =>
                processor.processorCode?.toUpperCase() === code &&
                processor.externalProcessorId !== editing?.externalProcessorId
        );

        if (code && duplicateCode) {
            nextErrors.processorCode =
                'This processor code already exists.';
        }

        setErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    };

    // ----------------------------------------------------------
    // SUBMIT
    // ----------------------------------------------------------

    const handleSubmit = (event) => {
        event.preventDefault();

        if (!validate()) {
            return;
        }

        onSave({
            ...form,
            processorCode: normalizeCode(form.processorCode),
            name: normalizeText(form.name),
            contactPerson: normalizeText(form.contactPerson),
            phone: normalizeText(form.phone),
            email: normalizeText(form.email),
            address: normalizeText(form.address),
            gstin: normalizeText(form.gstin).toUpperCase(),
            pan: normalizeText(form.pan).toUpperCase(),
            paymentTerms: normalizeText(form.paymentTerms),
            notes: normalizeText(form.notes),
            status: form.status || 'ACTIVE',
        });
    };

    // ----------------------------------------------------------
    // FIELD ERROR
    // ----------------------------------------------------------

    const renderError = (field) => (
        errors[field] ? (
            <span className="text-xs text-error-700">
                {errors[field]}
            </span>
        ) : null
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {errors.form && (
                <div className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">
                    {errors.form}
                </div>
            )}

            {/* BASIC DETAILS */}

            <section>
                <h3 className="mb-3 text-sm font-semibold text-navy-900">
                    Basic Details
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="processor-code"
                            className="text-sm font-medium text-navy-700"
                        >
                            Processor Code{' '}
                            <span className="text-error-500">*</span>
                        </label>

                        <input
                            id="processor-code"
                            type="text"
                            className="input-field uppercase"
                            value={form.processorCode}
                            onChange={(event) =>
                                handleChange(
                                    'processorCode',
                                    event.target.value.toUpperCase()
                                )
                            }
                            maxLength={30}
                            placeholder="e.g. POLISH-001"
                            autoComplete="off"
                            required
                            disabled={saving}
                        />

                        {renderError('processorCode')}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="processor-name"
                            className="text-sm font-medium text-navy-700"
                        >
                            Processor Name{' '}
                            <span className="text-error-500">*</span>
                        </label>

                        <input
                            id="processor-name"
                            type="text"
                            className="input-field"
                            value={form.name}
                            onChange={(event) =>
                                handleChange('name', event.target.value)
                            }
                            maxLength={150}
                            placeholder="Company or processor name"
                            required
                            disabled={saving}
                        />

                        {renderError('name')}
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label
                            htmlFor="processor-contact-person"
                            className="text-sm font-medium text-navy-700"
                        >
                            Contact Person
                        </label>

                        <input
                            id="processor-contact-person"
                            type="text"
                            className="input-field"
                            value={form.contactPerson}
                            onChange={(event) =>
                                handleChange(
                                    'contactPerson',
                                    event.target.value
                                )
                            }
                            maxLength={100}
                            placeholder="Contact person's name"
                            disabled={saving}
                        />

                        {renderError('contactPerson')}
                    </div>
                </div>
            </section>

            {/* CONTACT DETAILS */}

            <section className="border-t border-navy-100 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-navy-900">
                    Contact Details
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="processor-phone"
                            className="text-sm font-medium text-navy-700"
                        >
                            Phone Number
                        </label>

                        <input
                            id="processor-phone"
                            type="tel"
                            className="input-field"
                            value={form.phone}
                            onChange={(event) =>
                                handleChange('phone', event.target.value)
                            }
                            maxLength={20}
                            placeholder="Enter phone number"
                            disabled={saving}
                        />

                        {renderError('phone')}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="processor-email"
                            className="text-sm font-medium text-navy-700"
                        >
                            Email Address
                        </label>

                        <input
                            id="processor-email"
                            type="email"
                            className="input-field"
                            value={form.email}
                            onChange={(event) =>
                                handleChange('email', event.target.value)
                            }
                            maxLength={150}
                            placeholder="name@example.com"
                            disabled={saving}
                        />

                        {renderError('email')}
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label
                            htmlFor="processor-address"
                            className="text-sm font-medium text-navy-700"
                        >
                            Business Address
                        </label>

                        <textarea
                            id="processor-address"
                            className="input-field min-h-[80px] resize-y"
                            value={form.address}
                            onChange={(event) =>
                                handleChange('address', event.target.value)
                            }
                            placeholder="Enter business address"
                            disabled={saving}
                        />
                    </div>
                </div>
            </section>

            {/* TAX DETAILS */}

            <section className="border-t border-navy-100 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-navy-900">
                    Tax Details
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="processor-gstin"
                            className="text-sm font-medium text-navy-700"
                        >
                            GSTIN
                        </label>

                        <input
                            id="processor-gstin"
                            type="text"
                            className="input-field uppercase"
                            value={form.gstin}
                            onChange={(event) =>
                                handleChange(
                                    'gstin',
                                    event.target.value.toUpperCase()
                                )
                            }
                            maxLength={15}
                            placeholder="15-character GSTIN"
                            disabled={saving}
                        />

                        {renderError('gstin')}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="processor-pan"
                            className="text-sm font-medium text-navy-700"
                        >
                            PAN
                        </label>

                        <input
                            id="processor-pan"
                            type="text"
                            className="input-field uppercase"
                            value={form.pan}
                            onChange={(event) =>
                                handleChange(
                                    'pan',
                                    event.target.value.toUpperCase()
                                )
                            }
                            maxLength={10}
                            placeholder="10-character PAN"
                            disabled={saving}
                        />

                        {renderError('pan')}
                    </div>
                </div>
            </section>

            {/* BUSINESS DETAILS */}

            <section className="border-t border-navy-100 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-navy-900">
                    Business Details
                </h3>

                <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="processor-payment-terms"
                            className="text-sm font-medium text-navy-700"
                        >
                            Payment Terms
                        </label>

                        <input
                            id="processor-payment-terms"
                            type="text"
                            className="input-field"
                            value={form.paymentTerms}
                            onChange={(event) =>
                                handleChange(
                                    'paymentTerms',
                                    event.target.value
                                )
                            }
                            maxLength={100}
                            placeholder="e.g. 15 days after invoice"
                            disabled={saving}
                        />

                        {renderError('paymentTerms')}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="processor-notes"
                            className="text-sm font-medium text-navy-700"
                        >
                            Notes
                        </label>

                        <textarea
                            id="processor-notes"
                            className="input-field min-h-[80px] resize-y"
                            value={form.notes}
                            onChange={(event) =>
                                handleChange('notes', event.target.value)
                            }
                            placeholder="Additional information about this processor"
                            disabled={saving}
                        />
                    </div>
                </div>
            </section>

            {/* STATUS */}

            {editing && (
                <section className="border-t border-navy-100 pt-4">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="processor-status"
                            className="text-sm font-medium text-navy-700"
                        >
                            Status
                        </label>

                        <select
                            id="processor-status"
                            className="input-field"
                            value={form.status}
                            onChange={(event) =>
                                handleChange('status', event.target.value)
                            }
                            disabled={saving}
                        >
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                        </select>

                        <p className="text-xs leading-5 text-navy-500">
                            Deactivating a processor prevents it from being
                            selected for new job work. Historical jobs remain
                            available.
                        </p>
                    </div>
                </section>
            )}

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
                            ? 'Update Processor'
                            : 'Add Processor'}
                </button>
            </div>
        </form>
    );
}
