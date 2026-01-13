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
                    signal: AbortSignal.timeout(25000) // Extended timeout to 25s to beat slow NREGA response
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

        // Step 1: Loading Initial Page
        let currentUrl = url;
        log(`Step 1: Loading Initial Page...`);
        let html = await fetchPage(currentUrl);
        let $ = cheerio.load(html);

        // SMART NAVIGATION LOGIC
        // Check if we are already deep in the site (Block Page or District Page)

        let foundPanchayatDirectly = false;

        // CHECK 1: Are we already on the Block Page? (Is the Panchayat visible?)
        if (panchayat) {
            const searchP = panchayat.toLowerCase().trim();
            const directPanchayatRow = $('tr').filter((i, row) => $(row).text().toLowerCase().includes(searchP)).first();
            if (directPanchayatRow.length > 0) {
                log(`🎯 Smart Jump: Found Panchayat '${panchayat}' immediately! Skipping navigation steps.`);
                foundPanchayatDirectly = true;
            }
        }

        // If not found directly, try navigation path
        if (!foundPanchayatDirectly) {

            // CHECK 2: Are we on the District Page? (Is the Block visible?)
            let skippedDistrict = false;
            if (block && !foundPanchayatDirectly) {
                const directBlockLink = findLink($, block);
                if (directBlockLink) {
                    log(`🎯 Smart Jump: Found Block '${block}' link immediately! Skipping District step.`);
                    skippedDistrict = true;

                    // Click Block
                    currentUrl = resolveUrl(currentUrl, directBlockLink);
                    log(`Navigating to Block Page: ${directBlockLink}...`);
                    html = await fetchPage(currentUrl);
                    $ = cheerio.load(html);
                }
            }

            // CHECK 3: Standard Flow (State -> District)
            if (!skippedDistrict && district) {
                log(`Step 2: Searching for District '${district}'...`);
                const districtLink = findLink($, district);

                if (districtLink) {
                    currentUrl = resolveUrl(currentUrl, districtLink);
                    log(`Found District Link: ${districtLink}. Navigating...`);
                    html = await fetchPage(currentUrl);
                    $ = cheerio.load(html);
                } else {
                    // If district not found, we might be lost, but let's check if the user provided a bad District name 
                    // or if we are on a page where District isn't listed (e.g. invalid URL)
                    // We log a warning but proceed to check for Block just in case
                    log(`⚠️ Warning: District '${district}' link not found. Assuming we might be at a deeper level or URL is incorrect. Continuing check...`);
                }
            }

            // CHECK 4: Block Step (if we didn't skip it earlier)
            if (!skippedDistrict && block) {
                log(`Step 3: Searching for Block '${block}'...`);
                const blockLink = findLink($, block);

                if (blockLink) {
                    currentUrl = resolveUrl(currentUrl, blockLink);
                    log(`Found Block Link: ${blockLink}. Navigating...`);
                    html = await fetchPage(currentUrl);
                    $ = cheerio.load(html);
                } else {
                    log(`⚠️ Warning: Block '${block}' link not found.`);
                    // Only throw if we haven't found the final target yet either
                    if (!panchayat) throw new Error(`Could not navigate to Block '${block}'.`);
                }
            }
        }

        // Final Step: Panchayat Selection
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

            if (!targetRow) throw new Error(`Panchayat '${panchayat}' row not found in table. (Are you on the correct Block page?)`);
            log(`Found Panchayat Row.`);

            const links = $(targetRow).find('a');
            let targetLink = null;

            links.each((i, link) => {
                const txt = $(link).text().trim();
                // We look for "No. of Vendors" which is usually a number
                if (/^\d+$/.test(txt)) {
                    targetLink = $(link).attr('href');
                    return false;
                }
            });

            if (!targetLink && links.length > 0) targetLink = links.last().attr('href');

            if (!targetLink) {
                // Fallback: If no link found, maybe we are ALREADY on the data page?
                // Check if the current page has the big table?
                // No, usually we need to click.
                throw new Error(`Could not find 'No. of vendors' link for '${panchayat}'.`);
            }

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
