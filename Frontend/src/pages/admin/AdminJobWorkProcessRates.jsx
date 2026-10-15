
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    CalendarDays,
    CircleDollarSign,
    ClipboardList,
    Pencil,
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
// CONSTANTS
// ============================================================

const RATES_ENDPOINT = '/api/job-work/process-rates';
const PROCESS_TYPES_ENDPOINT = '/api/job-work/process-types';

const CHARGE_UNITS = [
    { value: 'PER_CARAT', label: 'Per carat' },
    { value: 'PER_PIECE', label: 'Per piece' },
    { value: 'PER_GRAM', label: 'Per gram' },
    { value: 'PER_JOB', label: 'Per job / fixed job charge' },
];

const EMPTY_FORM = {
    processTypeId: '',
    rateMonth: '',
    chargeUnit: 'PER_PIECE',
    rate: '',
};

// ============================================================
// HELPERS
// ============================================================

const getCurrentMonth = () => {
    const now = new Date();

    return `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, '0')}`;
};

const getErrorMessage = (error, fallback) => (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.data?.message ||
    error?.message ||
    fallback
);

// Normalize API values to YYYY-MM.
//
// Supports:
//   2026-10
//   2026-10-01
//   2026-10-01T00:00:00.000Z
const getRateMonthKey = (value) => {
    if (!value) {
        return '';
    }

    const match = String(value).trim().match(
        /^(\d{4})-(\d{2})/
    );

    if (!match) {
        return '';
    }

    const month = Number(match[2]);

    if (month < 1 || month > 12) {
        return '';
    }

    return `${match[1]}-${match[2]}`;
};

const formatRateMonth = (value) => {
    const monthKey = getRateMonthKey(value);

    if (!monthKey) {
        return 'Not selected';
    }

    const [year, month] = monthKey.split('-').map(Number);

    return new Intl.DateTimeFormat('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(
        new Date(Date.UTC(year, month - 1, 1))
    );
};

const formatCurrency = (value) => {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return '—';
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return '—';
    }

    return `₹${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const getChargeUnitLabel = (value) => (
    CHARGE_UNITS.find(
        (unit) => unit.value === value
    )?.label ||
    String(value || 'Not specified').replaceAll('_', ' ')
);

const normalizeRate = (rate) => ({
    ...rate,
    processTypeId: Number(rate.processTypeId),
    rateMonth: getRateMonthKey(rate.rateMonth),
});

// ============================================================
// ADMIN MONTHLY PROCESSING RATES
// ============================================================

export function AdminJobWorkProcessRates() {
    const { toast } = useToast();

    // ----------------------------------------------------------
    // STATE
    // ----------------------------------------------------------

    const [selectedMonth, setSelectedMonth] = useState(
        () => getCurrentMonth()
    );

    const [rates, setRates] = useState([]);
    const [loadedRatesMonth, setLoadedRatesMonth] = useState('');

    const [processTypes, setProcessTypes] = useState([]);

    const [loading, setLoading] = useState(true);
    const [typesLoading, setTypesLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formVersion, setFormVersion] = useState(0);

    // ----------------------------------------------------------
    // CURRENT MONTH RATES
    // ----------------------------------------------------------

    // Never use the previous month's records while a new month's
    // request is pending.
    const currentMonthRates = useMemo(() => {
        if (loadedRatesMonth !== selectedMonth) {
            return [];
        }

        return rates.filter(
            (rate) => rate.rateMonth === selectedMonth
        );
    }, [rates, loadedRatesMonth, selectedMonth]);

    // ----------------------------------------------------------
    // AVAILABLE PROCESSING TYPES
    // ----------------------------------------------------------

    // This is the primary dropdown fix.
    //
    // If CUTTING already has an October price, CUTTING is removed
    // from the October Add dropdown.
    //
    // If November has no CUTTING rate, CUTTING is available again
    // when November is selected.
    const availableProcessTypes = useMemo(() => {
        const pricedProcessTypeIds = new Set(
            currentMonthRates.map(
                (rate) => Number(rate.processTypeId)
            )
        );

        return processTypes.filter(
            (type) =>
                !pricedProcessTypeIds.has(
                    Number(type.processTypeId)
                )
        );
    }, [processTypes, currentMonthRates]);

    // ----------------------------------------------------------
    // LOAD MONTHLY PROCESSING RATES
    // ----------------------------------------------------------

    const loadRates = useCallback(async () => {
        setLoading(true);

        // Mark the loaded month as unavailable until this request
        // completes. This prevents stale data from enabling Add.
        setLoadedRatesMonth('');

        try {
            const response = await apiClient.get(
                RATES_ENDPOINT,
                {
                    params: {
                        rateMonth: selectedMonth,
                    },
                }
            );

            const records = response?.data?.data;

            if (!Array.isArray(records)) {
                throw new Error(
                    'The server returned an invalid monthly rate list.'
                );
            }

            const normalizedRecords = records.map(normalizeRate);

            setRates(normalizedRecords);
            setLoadedRatesMonth(selectedMonth);
        } catch (error) {
            setRates([]);
            setLoadedRatesMonth('');

            toast(
                getErrorMessage(
                    error,
                    'Unable to load monthly processing rates.'
                ),
                'error'
            );
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, toast]);

    useEffect(() => {
        loadRates();
    }, [loadRates]);

    // ----------------------------------------------------------
    // LOAD ACTIVE PROCESSING TYPES
    // ----------------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        const loadTypes = async () => {
            setTypesLoading(true);

            try {
                const response = await apiClient.get(
                    PROCESS_TYPES_ENDPOINT,
                    {
                        params: {
                            status: 'ACTIVE',
                        },
                    }
                );

                const records = response?.data?.data;

                if (!Array.isArray(records)) {
                    throw new Error(
                        'The server returned an invalid processing type list.'
                    );
                }

                if (!cancelled) {
                    setProcessTypes(records);
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
                    setTypesLoading(false);
                }
            }
        };

        loadTypes();

        return () => {
            cancelled = true;
        };
    }, [toast]);

    // ----------------------------------------------------------
    // SEARCH
    // ----------------------------------------------------------

    const filteredRates = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) {
            return currentMonthRates;
        }

        return currentMonthRates.filter((item) => {
            const values = [
                item.processType?.code,
                item.processType?.name,
                item.chargeUnit,
                item.rate,
                item.rateMonth,
            ];

            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });
    }, [currentMonthRates, search]);

    // ----------------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------------

    const totalRates = currentMonthRates.length;

    const totalProcessesWithRates = new Set(
        currentMonthRates.map(
            (item) => Number(item.processTypeId)
        )
    ).size;

    const ratesLoadedForSelectedMonth =
        loadedRatesMonth === selectedMonth && !loading;

    const noTypesAvailable =
        processTypes.length > 0 &&
        availableProcessTypes.length === 0;

    // ----------------------------------------------------------
    // OPEN ADD FORM
    // ----------------------------------------------------------

    const handleAdd = () => {
        if (
            loading ||
            loadedRatesMonth !== selectedMonth
        ) {
            toast(
                'Please wait until the selected month rates finish loading.',
                'error'
            );
            return;
        }

        if (typesLoading) {
            toast(
                'Please wait until processing types finish loading.',
                'error'
            );
            return;
        }

        if (processTypes.length === 0) {
            toast(
                'No active processing types are available. Add an active processing type first.',
                'error'
            );
            return;
        }

        if (availableProcessTypes.length === 0) {
            toast(
                `Every active processing type already has a rate for ${formatRateMonth(selectedMonth)}. Select another month to enter new prices.`,
                'error'
            );
            return;
        }

        setEditing(null);
        setFormVersion((value) => value + 1);
        setModalOpen(true);
    };

    // ----------------------------------------------------------
    // OPEN EDIT FORM
    // ----------------------------------------------------------

    const handleEdit = (rate) => {
        setEditing(rate);
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
    // CREATE / UPDATE MONTHLY RATE
    // ----------------------------------------------------------

    const handleSave = async (formData) => {
        try {
            setSaving(true);

            const payload = editing
                ? {
                    rate: formData.rate,
                    chargeUnit: formData.chargeUnit,
                }
                : {
                    processTypeId: Number(
                        formData.processTypeId
                    ),
                    rateMonth: formData.rateMonth,
                    chargeUnit: formData.chargeUnit,
                    rate: formData.rate,
                };

            // Additional duplicate protection before calling
            // the API. Database uniqueness remains authoritative.
            if (!editing) {
                if (loadedRatesMonth !== payload.rateMonth) {
                    throw new Error(
                        'The selected month has not finished loading. Please wait and try again.'
                    );
                }

                const duplicate = currentMonthRates.some(
                    (item) =>
                        Number(item.processTypeId) ===
                            payload.processTypeId &&
                        item.rateMonth === payload.rateMonth
                );

                if (duplicate) {
                    throw new Error(
                        'A price already exists for this processing type and month. Select another month to add a new price.'
                    );
                }

                // Also ensure the processing type is in the list
                // of types currently eligible for this month.
                const available = availableProcessTypes.some(
                    (type) =>
                        Number(type.processTypeId) ===
                        payload.processTypeId
                );

                if (!available) {
                    throw new Error(
                        'This processing type already has a price for the selected month. Choose a different processing type or month.'
                    );
                }
            }

            const response = editing
                ? await apiClient.patch(
                    `${RATES_ENDPOINT}/${editing.processRateId}`,
                    payload
                )
                : await apiClient.post(
                    RATES_ENDPOINT,
                    payload
                );

            const savedRate = response?.data?.data;

            if (!savedRate?.processRateId) {
                throw new Error(
                    'The server did not return the saved monthly rate.'
                );
            }

            const normalizedRate = normalizeRate(savedRate);

            setModalOpen(false);
            setEditing(null);

            toast(
                response?.data?.message ||
                    (
                        editing
                            ? 'Monthly rate updated successfully.'
                            : 'Monthly rate created successfully.'
                    ),
                'success'
            );

            const savedMonth =
                normalizedRate.rateMonth || selectedMonth;

            if (savedMonth !== selectedMonth) {
                setSelectedMonth(savedMonth);
            } else {
                await loadRates();
            }
        } catch (error) {
            toast(
                getErrorMessage(
                    error,
                    'Unable to save the monthly processing rate.'
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
            key: 'processType',
            label: 'Processing Type',
            render: (item) => (
                <div className="min-w-[160px]">
                    <p className="font-medium text-navy-900">
                        {item.processType?.name || 'Unknown type'}
                    </p>

                    <p className="mt-0.5 font-mono text-xs text-navy-500">
                        {item.processType?.code || '—'}
                    </p>
                </div>
            ),
        },
        {
            key: 'rateMonth',
            label: 'Rate Month',
            render: (item) => (
                <span className="text-sm text-navy-700">
                    {formatRateMonth(item.rateMonth)}
                </span>
            ),
        },
        {
            key: 'chargeUnit',
            label: 'Charge Unit',
            render: (item) => (
                <span className="text-sm text-navy-700">
                    {getChargeUnitLabel(item.chargeUnit)}
                </span>
            ),
        },
        {
            key: 'rate',
            label: 'Processing Rate',
            render: (item) => (
                <div>
                    <p className="font-semibold text-navy-900">
                        {formatCurrency(item.rate)}
                    </p>

                    <p className="mt-0.5 text-xs text-navy-500">
                        {getChargeUnitLabel(item.chargeUnit)}
                    </p>
                </div>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (item) => (
                <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Pencil size={14} />
                    Edit
                </button>
            ),
        },
    ];

    // ----------------------------------------------------------
    // PAGE
    // ----------------------------------------------------------

    return (
        <div className="space-y-6">
            <PageHeader
                title="Monthly Processing Rates"
                subtitle={`Configure prices for ${formatRateMonth(selectedMonth)}. Each processing type can have one price per month.`}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={loadRates}
                            disabled={loading}
                        >
                            <RefreshCw
                                size={16}
                                className={
                                    loading ? 'animate-spin' : ''
                                }
                            />
                            Refresh
                        </button>

                        <button
                            type="button"
                            className="btn-primary"
                            onClick={handleAdd}
                            disabled={
                                loading ||
                                typesLoading ||
                                saving ||
                                !ratesLoadedForSelectedMonth ||
                                processTypes.length === 0 ||
                                noTypesAvailable
                            }
                            title={
                                noTypesAvailable
                                    ? 'All active processing types already have prices for this month.'
                                    : 'Add a monthly processing rate'
                            }
                        >
                            <Plus size={18} />
                            Add Monthly Rate
                        </button>
                    </div>
                }
            />

            {/* SUMMARY CARDS */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-navy-100 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-accent-50 p-2.5">
                            <CalendarDays
                                size={20}
                                className="text-accent-700"
                            />
                        </div>

                        <div>
                            <p className="text-sm text-navy-500">
                                Selected Month
                            </p>

                            <p className="font-semibold text-navy-900">
                                {formatRateMonth(selectedMonth)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-navy-100 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-accent-50 p-2.5">
                            <CircleDollarSign
                                size={20}
                                className="text-accent-700"
                            />
                        </div>

                        <div>
                            <p className="text-sm text-navy-500">
                                Configured Rates
                            </p>

                            <p className="text-xl font-semibold text-navy-900">
                                {ratesLoadedForSelectedMonth
                                    ? totalRates
                                    : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-navy-100 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-accent-50 p-2.5">
                            <ClipboardList
                                size={20}
                                className="text-accent-700"
                            />
                        </div>

                        <div>
                            <p className="text-sm text-navy-500">
                                Processes With Rates
                            </p>

                            <p className="text-xl font-semibold text-navy-900">
                                {ratesLoadedForSelectedMonth
                                    ? totalProcessesWithRates
                                    : '—'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* MONTH FILTER AND SEARCH */}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex w-full flex-col gap-1.5 sm:max-w-xs">
                    <label
                        htmlFor="job-work-rate-month"
                        className="text-sm font-medium text-navy-700"
                    >
                        Rate Month
                    </label>

                    <input
                        id="job-work-rate-month"
                        type="month"
                        className="input-field"
                        value={selectedMonth}
                        onChange={(event) => {
                            const month = event.target.value;

                            if (month) {
                                setSelectedMonth(month);
                                setSearch('');
                            }
                        }}
                        required
                    />
                </div>

                <div className="w-full sm:max-w-sm">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Search process, rate or charge unit..."
                    />
                </div>
            </div>

            {/* MONTH STATUS MESSAGE */}

            {ratesLoadedForSelectedMonth &&
                noTypesAvailable && (
                    <div className="rounded-xl border border-navy-200 bg-white p-4">
                        <p className="text-sm font-semibold text-navy-800">
                            All active processing types already have a rate
                        </p>

                        <p className="mt-1 text-sm leading-6 text-navy-500">
                            Every active processing type has a configured
                            price for {formatRateMonth(selectedMonth)}.
                            To enter a new price, select another month.
                        </p>
                    </div>
                )}

            {/* RATE TABLE */}

            {loading && loadedRatesMonth !== selectedMonth ? (
                <div className="rounded-xl border border-navy-100 bg-white p-8 text-center text-sm text-navy-500">
                    Loading monthly processing rates...
                </div>
            ) : filteredRates.length === 0 ? (
                <EmptyState
                    icon={
                        search.trim()
                            ? Search
                            : ClipboardList
                    }
                    title={
                        currentMonthRates.length === 0
                            ? 'No monthly rates configured'
                            : 'No matching rates found'
                    }
                    message={
                        currentMonthRates.length === 0
                            ? `No prices have been configured for ${formatRateMonth(selectedMonth)}. Previous months' prices are not copied automatically. Add a price when the new monthly rate is known.`
                            : 'Try a different search term.'
                    }
                    action={
                        currentMonthRates.length === 0 &&
                        !search.trim() &&
                        availableProcessTypes.length > 0 ? (
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleAdd}
                                disabled={
                                    loading ||
                                    typesLoading ||
                                    saving ||
                                    !ratesLoadedForSelectedMonth
                                }
                            >
                                <Plus size={17} />
                                Add Monthly Rate
                            </button>
                        ) : undefined
                    }
                />
            ) : (
                <DataTable
                    columns={columns}
                    data={filteredRates}
                    emptyMessage="No monthly rates found."
                />
            )}

            {/* ADD / EDIT MODAL */}

            <Modal
                open={modalOpen}
                onClose={closeModal}
                title={
                    editing
                        ? 'Edit Monthly Processing Rate'
                        : 'Add Monthly Processing Rate'
                }
                size="lg"
            >
                <JobWorkProcessRateForm
                    key={formVersion}
                    editing={editing}
                    processTypes={
                        editing
                            ? processTypes
                            : availableProcessTypes
                    }
                    selectedMonth={selectedMonth}
                    rates={currentMonthRates}
                    ratesMonth={loadedRatesMonth}
                    saving={saving}
                    onCancel={closeModal}
                    onSave={handleSave}
                />
            </Modal>
        </div>
    );
}

// ============================================================
// MONTHLY PROCESSING RATE FORM
// ============================================================

function JobWorkProcessRateForm({
    editing,
    processTypes,
    selectedMonth,
    rates,
    ratesMonth,
    saving,
    onCancel,
    onSave,
}) {
    const [form, setForm] = useState({
        ...EMPTY_FORM,
        processTypeId: editing
            ? String(editing.processTypeId)
            : '',
        rateMonth: editing
            ? editing.rateMonth
            : selectedMonth,
        chargeUnit: editing?.chargeUnit || 'PER_PIECE',
        rate:
            editing?.rate === null ||
            editing?.rate === undefined
                ? ''
                : String(editing.rate),
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

        if (!editing && !form.processTypeId) {
            nextErrors.processTypeId =
                'Select a processing type.';
        }

        if (
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.rateMonth)
        ) {
            nextErrors.rateMonth =
                'Select a valid rate month.';
        }

        if (!editing && ratesMonth !== form.rateMonth) {
            nextErrors.form =
                'The selected month has not finished loading. Please wait and try again.';
        }

        if (
            !CHARGE_UNITS.some(
                (unit) => unit.value === form.chargeUnit
            )
        ) {
            nextErrors.chargeUnit =
                'Select a valid charge unit.';
        }

        const rateText = String(form.rate).trim();

        if (!rateText) {
            nextErrors.rate =
                'Processing rate is required. Leave this month without a rate until its price is known.';
        } else if (!/^\d+(\.\d{1,2})?$/.test(rateText)) {
            nextErrors.rate =
                'Enter a non-negative rate with at most two decimal places.';
        } else {
            const amount = Number(rateText);

            if (
                !Number.isFinite(amount) ||
                amount > 9999999999.99
            ) {
                nextErrors.rate =
                    'Rate is outside the supported range.';
            }
        }

        // Double-check duplicates when creating.
        if (
            !editing &&
            form.processTypeId &&
            form.rateMonth &&
            ratesMonth === form.rateMonth
        ) {
            const duplicate = rates.some(
                (item) =>
                    Number(item.processTypeId) ===
                        Number(form.processTypeId) &&
                    item.rateMonth === form.rateMonth
            );

            if (duplicate) {
                nextErrors.processTypeId =
                    'A price already exists for this processing type and month. Select another month to add a new price.';
            }

            const typeIsAvailable = processTypes.some(
                (type) =>
                    Number(type.processTypeId) ===
                    Number(form.processTypeId)
            );

            if (!typeIsAvailable) {
                nextErrors.processTypeId =
                    'This processing type is not available for a new rate in the selected month.';
            }
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
            processTypeId: Number(form.processTypeId),
            rate: String(form.rate).trim(),
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
        <form
            onSubmit={handleSubmit}
            className="space-y-5"
        >
            {errors.form && (
                <div className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">
                    {errors.form}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* PROCESSING TYPE */}

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label
                        htmlFor="job-work-rate-process-type"
                        className="text-sm font-medium text-navy-700"
                    >
                        Processing Type
                        <span className="text-error-500"> *</span>
                    </label>

                    <select
                        id="job-work-rate-process-type"
                        className="input-field"
                        value={form.processTypeId}
                        onChange={(event) =>
                            handleChange(
                                'processTypeId',
                                event.target.value
                            )
                        }
                        disabled={saving || Boolean(editing)}
                        required
                    >
                        <option value="">
                            Select processing type
                        </option>

                        {processTypes.map((type) => (
                            <option
                                key={type.processTypeId}
                                value={type.processTypeId}
                            >
                                {type.code} — {type.name}
                            </option>
                        ))}
                    </select>

                    {processTypes.length === 0 && !editing && (
                        <p className="text-xs text-navy-500">
                            All active processing types already have
                            prices for this month, or no active types
                            are available.
                        </p>
                    )}

                    {renderError('processTypeId')}
                </div>

                {/* RATE MONTH */}

                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="job-work-rate-form-month"
                        className="text-sm font-medium text-navy-700"
                    >
                        Rate Month
                        <span className="text-error-500"> *</span>
                    </label>

                    <input
                        id="job-work-rate-form-month"
                        type="month"
                        className="input-field"
                        value={form.rateMonth}
                        disabled
                        required
                    />

                    {renderError('rateMonth')}

                    <p className="text-xs text-navy-500">
                        To enter a price for another month, close
                        this form and change the month filter.
                    </p>
                </div>

                {/* CHARGE UNIT */}

                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="job-work-rate-charge-unit"
                        className="text-sm font-medium text-navy-700"
                    >
                        Charge Unit
                        <span className="text-error-500"> *</span>
                    </label>

                    <select
                        id="job-work-rate-charge-unit"
                        className="input-field"
                        value={form.chargeUnit}
                        onChange={(event) =>
                            handleChange(
                                'chargeUnit',
                                event.target.value
                            )
                        }
                        disabled={saving}
                        required
                    >
                        <option value="">
                            Select charge unit
                        </option>

                        {CHARGE_UNITS.map((unit) => (
                            <option
                                key={unit.value}
                                value={unit.value}
                            >
                                {unit.label}
                            </option>
                        ))}
                    </select>

                    {renderError('chargeUnit')}
                </div>

                {/* RATE */}

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label
                        htmlFor="job-work-rate-amount"
                        className="text-sm font-medium text-navy-700"
                    >
                        Processing Rate (₹)
                        <span className="text-error-500"> *</span>
                    </label>

                    <input
                        id="job-work-rate-amount"
                        type="number"
                        className="input-field"
                        value={form.rate}
                        onChange={(event) =>
                            handleChange(
                                'rate',
                                event.target.value
                            )
                        }
                        min="0"
                        max="9999999999.99"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Enter rate"
                        required
                        disabled={saving}
                    />

                    {renderError('rate')}

                    <p className="text-xs leading-5 text-navy-500">
                        Only one price is allowed per processing
                        type per month. Previous months' prices are
                        not copied automatically. Receipts should use
                        the rate for their receipt month.
                    </p>
                </div>
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
                    disabled={
                        saving ||
                        (!editing && processTypes.length === 0)
                    }
                >
                    {saving
                        ? 'Saving...'
                        : editing
                            ? 'Update Monthly Rate'
                            : 'Create Monthly Rate'}
                </button>
            </div>
        </form>
    );
}
