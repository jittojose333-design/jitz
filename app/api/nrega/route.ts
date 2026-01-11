import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Helper to resolve relative URLs
const resolveUrl = (base: string, relative: string) => {
    try {
        return new URL(relative, base).href;
    } catch (e) {
        return relative;
    }
};

// Helper to find link by approximate text
const findLink = ($: cheerio.CheerioAPI, text: string) => {
    if (!text) return null;
    const search = text.toLowerCase().trim();

    // Try exact match first
    let el = $(`a`).filter((i, el) => $(el).text().toLowerCase().trim() === search).first();

    // Try contains if no exact match
    if (el.length === 0) {
        el = $(`a`).filter((i, el) => $(el).text().toLowerCase().includes(search)).first();
    }

    return el.length > 0 ? el.attr('href') : null;
};

// Start of the robust scraping logic
export async function POST(req: NextRequest) {
    try {
        const { url, district, block, panchayat } = await req.json();

        if (!url) return NextResponse.json({ error: 'Initial URL is required' }, { status: 400 });

        const fetchPage = async (pageUrl: string) => {
            console.log('Fetching:', pageUrl);
            const res = await fetch(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${pageUrl}`);
            return await res.text();
        };

        // Helper to find Panchayat on the current page
        const findAndScrapePanchayatRow = async ($context: cheerio.CheerioAPI, pName: string) => {
            // Find the row containing the Panchayat Name
            let targetRow: cheerio.Cheerio<any> | null = null;
            const searchP = pName.toLowerCase().trim();

            $context('tr').each((i, row) => {
                const rowText = $context(row).text().toLowerCase();
                if (rowText.includes(searchP)) {
                    targetRow = $context(row);
                    return false; // Break loop
                }
            });

            if (!targetRow) return null;

            const links = $context(targetRow).find('a');
            let targetLink: string | undefined = undefined;

            // Logic: Pick the link that is entirely numeric or ends with a number
            links.each((i, link) => {
                const txt = $context(link).text().trim();
                if (/^\d+$/.test(txt)) {
                    targetLink = $context(link).attr('href');
                    return false; // Found the number link
                }
            });

            // Fallback
            if (!targetLink && links.length > 0) {
                targetLink = links.last().attr('href');
            }

            return targetLink;
        };

        // Step 1: Loading State Page (Provided URL)
        let currentUrl = url;
        let html = await fetchPage(currentUrl);
        let $ = cheerio.load(html);

        // OPTIMIZATION: Check if we are ALREADY on the Panchayat List page (Block Page)
        // If the user pastes the Block URL, we can skip District/Block navigation steps.
        if (panchayat) {
            const directLink = await findAndScrapePanchayatRow($, panchayat);
            if (directLink) {
                console.log("Optimization: Found Panchayat directly on initial page. Skipping navigation.");
                currentUrl = resolveUrl(currentUrl, directLink);
                html = await fetchPage(currentUrl);
                $ = cheerio.load(html);
                // Skip to Step 5 (Scraping)
                // We clear district/block/panchayat flags effectively by jumping to end
                // But simply returning the flow to the scrape section is enough.
                // We will set flags to false to prevent further navigation logic
                district = null;
                block = null;
                panchayat = null; // Mark as handled
            }
        }

        // If district provided, click it
        if (district) {
            const districtLink = findLink($, district);
            if (!districtLink) throw new Error(`District '${district}' not found in the list.`);
            currentUrl = resolveUrl(currentUrl, districtLink);

            // Step 2: Fetch District Page
            html = await fetchPage(currentUrl);
            $ = cheerio.load(html);
        }

        // If block provided, click it
        if (block) {
            const blockLink = findLink($, block);
            if (!blockLink) throw new Error(`Block '${block}' not found inside ${district}.`);
            currentUrl = resolveUrl(currentUrl, blockLink);

            // Step 3: Fetch Block Page
            html = await fetchPage(currentUrl);
            $ = cheerio.load(html);
        }

        // If panchayat provided (and not handled by optimization)
        if (panchayat) {
            const targetLink = await findAndScrapePanchayatRow($, panchayat);
            if (!targetLink) throw new Error(`Panchayat '${panchayat}' not found/no vendor link.`);

            currentUrl = resolveUrl(currentUrl, targetLink);
            html = await fetchPage(currentUrl);
            $ = cheerio.load(html);
        }

        // Step 5: Scrape Table Data
        let tableData = '';
        $('tr').each((i, row) => {
            const cells = $(row).find('td, th');
            if (cells.length > 0) {
                const rowText = cells.map((j, cell) => $(cell).text().trim().replace(/\s+/g, ' ')).get().join('\t');
                if (rowText.length > 10) {
                    tableData += rowText + '\n';
                }
            }
        });

        if (tableData.length < 50) {
            throw new Error("No data table found on the final page.");
        }

        return NextResponse.json({ data: tableData, currentUrl });

    } catch (error: any) {
        console.error('Crawler Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
