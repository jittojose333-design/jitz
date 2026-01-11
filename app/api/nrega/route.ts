import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Helper to resolve relative URLs
const resolveUrl = (base: string, relative: string) => {
    try {
        return new URL(relative, base).href;
    } catch {
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
    const logs: string[] = [];
    const log = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    try {
        const { url, district, block, panchayat } = await req.json();

        if (!url) return NextResponse.json({ error: 'Initial URL is required' }, { status: 400 });

        // Simple Cookie Jar
        let cookieJar = '';

        const fetchPage = async (pageUrl: string) => {
            log(`Fetching URL: ${pageUrl}...`);
            const startTime = Date.now();
            try {
                const headers: any = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Upgrade-Insecure-Requests': '1',
                    'Connection': 'keep-alive'
                };

                // Attach existing cookies
                if (cookieJar) {
                    headers['Cookie'] = cookieJar;
                }

                const res = await fetch(pageUrl, {
                    method: 'GET',
                    headers: headers,
                    next: { revalidate: 0 },
                    signal: AbortSignal.timeout(9500) // 9.5s timeout (Netlify limit is 10s)
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status} (${res.statusText})`);
                }

                // Extract and Merge Cookies
                const setCookie = res.headers.get('set-cookie');
                if (setCookie) {
                    // Simple merge: append new cookies. Browsers are smarter, but this usually works for ASP.NET SessionIds
                    const newCookies = setCookie.split(',').map(c => c.split(';')[0]).join('; ');
                    cookieJar = cookieJar ? `${cookieJar}; ${newCookies}` : newCookies;
                    // Deduplicate isn't strictly necessary for simple cases but good practice
                }

                const text = await res.text();
                log(`Fetched ${text.length} bytes in ${Date.now() - startTime}ms`);
                return text;
            } catch (e: any) {
                const msg = e.cause ? e.cause.message : e.message;
                throw new Error(`Fetch Failed: ${msg}`);
            }
        };

        // Step 1: Loading State Page
        let currentUrl = url;
        log(`Step 1: Loading Initial State Page...`);
        let html = await fetchPage(currentUrl);
        let $ = cheerio.load(html);

        // If district provided
        if (district) {
            log(`Step 2: Searching for District '${district}'...`);
            const districtLink = findLink($, district);
            if (!districtLink) throw new Error(`District '${district}' link not found on page.`);

            currentUrl = resolveUrl(currentUrl, districtLink);
            log(`Found District Link: ${districtLink}. Navigating...`);

            html = await fetchPage(currentUrl);
            $ = cheerio.load(html);
        } else {
            log(`Skipping District step (not provided)`);
        }

        // If block provided
        if (block) {
            log(`Step 3: Searching for Block '${block}'...`);
            const blockLink = findLink($, block);
            if (!blockLink) throw new Error(`Block '${block}' link not found inside District page.`);

            currentUrl = resolveUrl(currentUrl, blockLink);
            log(`Found Block Link: ${blockLink}. Navigating...`);

            html = await fetchPage(currentUrl);
            $ = cheerio.load(html);
        } else {
            log(`Skipping Block step (not provided)`);
        }

        // If panchayat provided
        if (panchayat) {
            log(`Step 4: Searching for Panchayat '${panchayat}'...`);
            // Find the row containing the Panchayat Name
            let targetRow: cheerio.Cheerio<any> | null = null;
            const searchP = panchayat.toLowerCase().trim();

            $('tr').each((i, row) => {
                const rowText = $(row).text().toLowerCase();
                if (rowText.includes(searchP)) {
                    targetRow = $(row);
                    return false; // Break loop
                }
            });

            if (!targetRow) throw new Error(`Panchayat '${panchayat}' row not found in table.`);
            log(`Found Panchayat Row.`);

            const links = $(targetRow).find('a');
            let targetLink = null;

            links.each((i, link) => {
                const txt = $(link).text().trim();
                if (/^\d+$/.test(txt)) {
                    targetLink = $(link).attr('href');
                    return false;
                }
            });

            if (!targetLink && links.length > 0) targetLink = links.last().attr('href');

            if (!targetLink) throw new Error(`Could not find Vendor link for '${panchayat}'.`);

            currentUrl = resolveUrl(currentUrl, targetLink);
            log(`Found Vendor Link: ${targetLink}. Navigating to Final Page...`);

            html = await fetchPage(currentUrl);
            $ = cheerio.load(html);
        }

        // Step 5: Scrape Table Data
        log(`Step 5: Extracting Data Table...`);
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

        log(`Success! Extracted ${tableData.length} chars of data.`);
        return NextResponse.json({ data: tableData, currentUrl, logs });

    } catch (error: any) {
        log(`ERROR: ${error.message}`);
        return NextResponse.json({ error: error.message, logs }, { status: 500 });
    }
}
