export type DataType = 'number' | 'date' | 'string' | 'boolean' | 'unknown';

export const isMissingValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim().length === 0) return true;
  return false;
};

export const parseValue = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text.length === 0) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const date = Date.parse(text);
  if (!Number.isNaN(date) && text.length >= 6) return new Date(date);
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
  return text;
};

export const getValueType = (value: unknown): DataType => {
  if (value === null || value === undefined) return 'unknown';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (value instanceof Date) return 'date';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
};

export const getColumnStats = (values: unknown[]) => {
  const parsed = values.map((value) => parseValue(value));
  const nonMissing = parsed.filter((value) => value !== null) as (number | Date | string | boolean)[];
  const numeric = nonMissing.filter((value): value is number => typeof value === 'number');
  const dates = nonMissing.filter((value): value is Date => value instanceof Date);
  const counts = new Map<string, number>();

  nonMissing.forEach((value) => {
    const key = value instanceof Date ? value.toISOString() : String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const sortedNumeric = [...numeric].sort((a, b) => a - b);
  const modeEntry = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  const type: DataType = numeric.length ? 'number' : dates.length ? 'date' : nonMissing.length ? 'string' : 'unknown';

  return {
    type,
    totalValues: values.length,
    missingValues: values.filter((value) => isMissingValue(value)).length,
    uniqueValues: counts.size,
    duplicateValues: nonMissing.length - counts.size,
    min: sortedNumeric.length ? sortedNumeric[0] : undefined,
    max: sortedNumeric.length ? sortedNumeric[sortedNumeric.length - 1] : undefined,
    mean: sortedNumeric.length ? sortedNumeric.reduce((sum, value) => sum + value, 0) / sortedNumeric.length : undefined,
    median: sortedNumeric.length
      ? sortedNumeric.length % 2 === 1
        ? sortedNumeric[(sortedNumeric.length - 1) / 2]
        : (sortedNumeric[sortedNumeric.length / 2 - 1] + sortedNumeric[sortedNumeric.length / 2]) / 2
      : undefined,
    mode: modeEntry ? modeEntry[0] : undefined
  };
};

export const normalizeReplacement = (value: unknown, type: DataType) => {
  if (type === 'number') {
    const numeric = parseFloat(String(value));
    return Number.isNaN(numeric) ? null : numeric;
  }
  if (type === 'date') {
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  if (type === 'boolean') {
    return String(value).toLowerCase() === 'true';
  }
  if (value === null || value === undefined) return null;
  return String(value);
};
