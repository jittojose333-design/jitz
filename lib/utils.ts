import * as XLSX from 'xlsx';
import { Order, BoardPrices } from '../types';

const findValue = (row: any, keywords: string[], fallback: string = '') => {
    const keys = Object.keys(row);
    const matchedKey = keys.find(key => {
        const k = key.toLowerCase();
        return keywords.some(kw => k.includes(kw.toLowerCase()));
    });
    return matchedKey ? row[matchedKey] : fallback;
};

export const parseExcelFile = (
    file: File,
    panchayatId?: string,
    panchayatName?: string,
    defaultBoardType: keyof BoardPrices = 'type1',
    boardPrices?: BoardPrices
): Promise<Partial<Order>[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                // Smart Header Search: Find the row that looks like a header
                // We look for a row containing 'work code' or 'work name' or 'items'
                let headerRowIndex = 0;
                const headerKeywords = ['work code', 'work_code', 'work no', 'sl no', 'code', 'work name', 'description', 'items'];

                for (let i = 0; i < Math.min(20, rawData.length); i++) {
                    const rowStr = rawData[i].map(c => String(c).toLowerCase()).join(' ');
                    if (headerKeywords.some(kw => rowStr.includes(kw))) {
                        headerRowIndex = i;
                        break;
                    }
                }

                // Re-parse from the identified header row
                const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
                range.s.r = headerRowIndex; // Set start row to header
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { range });

                const orders: Partial<Order>[] = (jsonData as any[]).map((row, index) => {
                    const wCode = findValue(row, ['work code', 'work_code', 'work no', 'sl no', 'code']);
                    const wName = findValue(row, ['work name', 'work_name', 'name of work', 'work title', 'description', 'items', 'project']);
                    const pName = findValue(row, ['panchayat', 'panchayath', 'local body', 'location']);
                    const qtyValue = findValue(row, ['quantity', 'qty', 'count', 'nos', 'number'], '1');
                    const amtValue = findValue(row, ['amount', 'total', 'price', 'cost'], '0');
                    const dt = findValue(row, ['date', 'time'], new Date().toISOString().split('T')[0]);

                    const quantity = parseFloat(String(qtyValue).replace(/[^0-9.]/g, '') || '1');
                    const rate = boardPrices ? boardPrices[defaultBoardType] : 0;

                    // Use calculated amount if rate exists, otherwise fallback to sheet amount
                    // Calculate total amount
                    // User Request: Initial amount should be 0. Value comes from NREGA sync.
                    const calculatedAmount = 0;

                    return {
                        id: `order-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2)}`,
                        panchayatId: panchayatId || 'default',
                        panchayatName: panchayatName || pName || 'Unknown',
                        date: dt,
                        items: wName || 'Boards',
                        quantity: quantity,
                        boardType: defaultBoardType,
                        rate: rate,
                        amount: calculatedAmount,
                        status: 'Unpaid',
                        workCode: String(wCode || '').trim(),
                        workName: String(wName || '').trim(),
                        isPlaced: false,
                    };
                });

                resolve(orders);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

export type DateRange = 'today' | 'this-week' | 'this-month' | 'last-3-months' | 'this-year' | 'ytd' | 'custom';

export const isDateInRange = (dateStr: string, range: DateRange, customStart?: string, customEnd?: string): boolean => {
    const date = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
        case 'today': return date >= startOfToday;
        case 'this-week': {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const startOfWeek = new Date(now.setDate(diff));
            startOfWeek.setHours(0, 0, 0, 0);
            return date >= startOfWeek;
        }
        case 'this-month': return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        case 'last-3-months': {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            return date >= threeMonthsAgo;
        }
        case 'this-year':
        case 'ytd': return date.getFullYear() === now.getFullYear();
        case 'custom':
            if (!customStart || !customEnd) return true;
            const start = new Date(customStart);
            const end = new Date(customEnd);
            end.setHours(23, 59, 59, 999);
            return date >= start && date <= end;
        default: return true;
    }
};
