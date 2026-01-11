import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Helper: Resolve relative URLs
const resolveUrl = (base: string, relative: string) => {
    try {
        return new URL(relative, base).href;
    } catch {
        return relative;
    }
};

// Helper: Fetch with browser-like headers
const fetchPage = async (pageUrl: string) => {
    console.log('Fetching:', pageUrl);
    try {
        const res = await fetch(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Upgrade-Insecure-Requests': '1',
                'Connection': 'keep-alive'
            },
            next: { revalidate: 0 }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } catch (e: any) {
        throw new Error(`Connection failed: ${pageUrl} (${e.message})`);
    }
};

export async function POST(req: NextRequest) {
    try {
        const { url, panchayat } = await req.json(); // Clean props
        if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

        let currentUrl = url;
        let html = await fetchPage(currentUrl);
        let $ = cheerio.load(html);

        // STRATEGY 1: Check if this IS the data page (Direct Link)
        // Look for a substantial table
        let tableData = extractTable($);
        if (tableData) {
            console.log("Success: Data found on initial URL (Direct Link).");
            return NextResponse.json({ data: tableData, currentUrl });
        }

        // STRATEGY 2: If we are on Block Page, find Panchayat
        if (panchayat) {
            console.log(`Searching for Panchayat: ${panchayat}`);
            const pLink = findLinkByText($, panchayat);

            if (pLink) {
                currentUrl = resolveUrl(currentUrl, pLink);
                html = await fetchPage(currentUrl);
                $ = cheerio.load(html);

                // Now we are on Panchayat Page. Check for table? Unlikely.
                // We need to find "No. of Vendors" or "Expenditure" link.

                // Try finding numeric link in first few rows or links
                const vendorLink = findVendorLink($);
                if (vendorLink) {
                    currentUrl = resolveUrl(currentUrl, vendorLink);
                    html = await fetchPage(currentUrl);
                    $ = cheerio.load(html);

                    tableData = extractTable($);
                    if (tableData) {
                        return NextResponse.json({ data: tableData, currentUrl });
                    }
                }
            }
        }

        throw new Error("Could not find data table. Try pasting the 'Vendor Expenditure' page URL directly.");

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// --- Utilities ---

function extractTable($: cheerio.CheerioAPI): string | null {
    // Logic: Look for table with > 5 rows and content looks like data
    let bestTable = '';
    let maxRows = 0;

    $('table').each((i, tbl) => {
        const rows = $(tbl).find('tr');
        if (rows.length > 5) { // Threshold for data table
            let currentTableText = '';
            rows.each((j, row) => {
                const cells = $(row).find('td, th');
                const rowText = cells.map((k, cell) => $(cell).text().trim().replace(/\s+/g, ' ')).get().join('\t');
                if (rowText.length > 10) currentTableText += rowText + '\n';
            });

            if (rows.length > maxRows) {
                maxRows = rows.length;
                bestTable = currentTableText;
            }
        }
    });

    return maxRows > 5 ? bestTable : null;
}

function findLinkByText($: cheerio.CheerioAPI, text: string): string | null {
    const search = text.toLowerCase().trim();
    let target = null;
    $('a').each((i, el) => {
        if ($(el).text().toLowerCase().includes(search)) {
            target = $(el).attr('href');
            return false;
        }
    });
    return target || null;
}

function findVendorLink($: cheerio.CheerioAPI): string | null {
    // Look for link that is a number (Vendor count)
    let target = null;
    $('a').each((i, el) => {
        const txt = $(el).text().trim();
        if (/^\d+$/.test(txt)) { // Is number?
            target = $(el).attr('href');
            return false;
        }
    });
    return target;
}
