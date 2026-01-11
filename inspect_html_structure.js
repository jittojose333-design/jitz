const cheerio = require('cheerio');
const https = require('https');

const BASE_URL = 'https://nregastrep.nic.in/netnrega/';
const START_URL = 'https://nregastrep.nic.in/netnrega/materialwise_exp.aspx?lflag=eng&flg=v&state_code=16&state_name=KERALA&page=s&fin_year=2025-2026&Digest=iGHV9dpfm0nO4UVhdORvSQ';

let cookieStore = [];

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const opts = new URL(url);
        const options = {
            hostname: opts.hostname,
            path: opts.pathname + opts.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': cookieStore.join('; ')
            }
        };

        const req = https.request(options, (res) => {
            const setCookie = res.headers['set-cookie'];
            if (setCookie) {
                setCookie.forEach(c => {
                    const part = c.split(';')[0];
                    if (!cookieStore.includes(part)) cookieStore.push(part);
                });
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', e => reject(e));
        req.end();
    });
}

async function run() {
    try {
        // Navigate to Marangattupilly (ID 15 at Uzhavoor)
        // 1. Digest
        let html = await fetchUrl(START_URL);
        let $ = cheerio.load(html);

        // 2. Kottayam
        let href = $('a:contains("KOTTAYAM")').attr('href');
        html = await fetchUrl(new URL(href, BASE_URL).toString());
        $ = cheerio.load(html);

        // 3. Uzhavoor
        href = $('a:contains("Uzhavoor")').attr('href');
        html = await fetchUrl(new URL(href, BASE_URL).toString());
        $ = cheerio.load(html);

        // 4. Marangattupilly (ID 15)
        let link15 = $('a').filter((i, el) => $(el).text().trim() === '15');
        href = link15.attr('href');
        if (!href) return console.log('Link 15 not found');

        html = await fetchUrl(new URL(href, BASE_URL).toString());
        $ = cheerio.load(html);

        console.log('\n--- Row Structure Analysis ---');
        let rowCount = 0;
        $('tr').each((i, row) => {
            const tds = $(row).find('td');
            if (tds.length === 0) return; // Skip header th usually? Or empty

            rowCount++;
            if (rowCount > 10) return; // Only check first 10 data rows

            console.log(`Row ${i}: ${tds.length} cells`);
            let rowInfo = [];
            tds.each((j, cell) => {
                const rowspan = $(cell).attr('rowspan');
                const text = $(cell).text().trim().substring(0, 20); // truncate
                if (rowspan) {
                    rowInfo.push(`[Cell ${j}: rowspan=${rowspan} "${text}"]`);
                } else {
                    rowInfo.push(`[Cell ${j}: "${text}"]`);
                }
            });
            console.log(rowInfo.join(' '));
        });

    } catch (e) {
        console.error(e);
    }
}

run();
