const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const config = require('./config');
const logger = require('./logger');

let browserPromise;

function getBrowser() {
    if (!browserPromise) {
        browserPromise = puppeteer.launch({
            headless: true,
            protocolTimeout: 30000,
            args: [
                '--allow-file-access-from-files',
                '--disable-web-security',
                '--no-sandbox'
            ]
        });
    }
    return browserPromise;
}

async function preparePage(page, filePath, viewport) {
    page.on('dialog', dialog => {
        dialog.dismiss().catch(() => {});
    });
    await page.setViewport(viewport);
    await page.goto(`file://${path.resolve(filePath)}`, {
        waitUntil: 'networkidle0',
        timeout: 15000
    }).catch(async () => {
        await page.goto(`file://${path.resolve(filePath)}`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
    });
    await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
    });
    await page.addStyleTag({
        content: `
            *, *::before, *::after {
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition-duration: 0s !important;
                caret-color: transparent !important;
            }
        `
    });
    await new Promise(resolve => setTimeout(resolve, 250));
}

async function clickButtonByText(page, labels) {
    return page.evaluate((targetLabels) => {
        const normalized = targetLabels.map(label => label.toLowerCase());
        const candidates = Array.from(document.querySelectorAll(
            'button, input[type="submit"], input[type="button"], [role="button"]'
        ));
        const target = candidates.find(element => {
            const label = (element.innerText || element.value || element.getAttribute('aria-label') || '')
                .trim()
                .toLowerCase();
            return normalized.some(expected => label.includes(expected));
        });
        if (!target) return false;
        target.click();
        return true;
    }, labels);
}

async function clickElementByText(page, labels) {
    return page.evaluate((targetLabels) => {
        const normalized = targetLabels.map(label => label.toLowerCase());
        const candidates = Array.from(document.querySelectorAll(
            'button, a, [role="button"], [role="tab"], summary, .tab, .question, .accordion-header, .day, .star'
        ));
        const target = candidates.find(element => {
            const label = (element.innerText || element.textContent || element.getAttribute('aria-label') || '')
                .trim()
                .toLowerCase();
            return normalized.some(expected => label.includes(expected));
        });
        if (!target) return false;
        target.click();
        return true;
    }, labels);
}

async function hoverElementByText(page, labels) {
    const handle = await page.evaluateHandle((targetLabels) => {
        const normalized = targetLabels.map(label => label.toLowerCase());
        return Array.from(document.querySelectorAll('button, a, div, span, [role="button"]'))
            .find(element => {
                const label = (element.innerText || element.textContent || element.getAttribute('aria-label') || '')
                    .trim()
                    .toLowerCase();
                return normalized.some(expected => label === expected || label.startsWith(expected));
            }) || null;
    }, labels);
    const element = handle.asElement();
    if (!element) {
        await handle.dispose();
        return false;
    }
    await element.hover();
    await handle.dispose();
    return true;
}

async function chooseFirstInteractive(page, selector) {
    return page.evaluate(targetSelector => {
        const target = document.querySelector(targetSelector);
        if (!target) return false;
        target.click();
        return true;
    }, selector);
}

async function dispatchMockUpload(page) {
    return page.evaluate(() => {
        const input = document.querySelector('input[type="file"]');
        const dropZone = document.querySelector('[class*="drop"], [id*="drop"]');
        const file = new File(['visual feedback pilot'], 'pilot-image.png', { type: 'image/png' });
        const transfer = new DataTransfer();
        transfer.items.add(file);

        if (input) {
            input.files = transfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        if (dropZone) {
            dropZone.dispatchEvent(new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: transfer
            }));
            return true;
        }
        return false;
    });
}

async function fillInputs(page, values) {
    await page.evaluate((inputValues) => {
        const fields = Array.from(document.querySelectorAll('input, textarea'))
            .filter(element => {
                const type = (element.getAttribute('type') || 'text').toLowerCase();
                return !['hidden', 'submit', 'button', 'file', 'checkbox', 'radio'].includes(type);
            });
        fields.forEach((field, index) => {
            if (inputValues[index] === undefined) return;
            field.focus();
            field.value = inputValues[index];
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }, values);
}

async function runTaskScenario(page, taskName) {
    const scenarios = {
        task1_login: async () => {
            await fillInputs(page, ['pilot@example.com', 'SecurePass123!']);
            return clickButtonByText(page, ['submit', 'login', 'sign in']);
        },
        task2_shopping_cart: async () => {
            await fillInputs(page, ['SAVE20']);
            return clickButtonByText(page, ['apply']);
        },
        task3_chat_ui: async () => {
            await fillInputs(page, ['A visual feedback test message']);
            return clickButtonByText(page, ['send']);
        },
        task4_dashboard: async () => false,
        task5_modal: async () => {
            await fillInputs(page, ['pilot@example.com']);
            return clickButtonByText(page, ['subscribe']);
        },
        task6_carousel: async () => clickElementByText(page, ['next', '→']),
        task7_dropdown_nav: async () => hoverElementByText(page, ['products']),
        task8_video_player: async () => clickElementByText(page, ['play']),
        task9_autocomplete: async () => {
            await fillInputs(page, ['access']);
            return true;
        },
        task10_progress_bar: async () => clickElementByText(page, ['start upload', 'start']),
        task11_tabs: async () => clickElementByText(page, ['settings']),
        task12_accordion: async () => chooseFirstInteractive(page, 'button, [role="button"], .question, .accordion-header'),
        task13_todo_list: async () => {
            await fillInputs(page, ['Review visual telemetry']);
            return clickElementByText(page, ['add']);
        },
        task14_star_rating: async () => chooseFirstInteractive(page, '[data-rating="4"], [data-value="4"], .star:nth-of-type(4), .star'),
        task15_cookie_banner: async () => clickElementByText(page, ['accept']),
        task16_profile_card: async () => false,
        task17_calendar: async () => chooseFirstInteractive(page, 'button[data-date], .day:not(.header), [role="gridcell"]'),
        task18_toast_notification: async () => clickElementByText(page, ['show', 'notify', 'toast']),
        task19_pricing_table: async () => false,
        task20_comments: async () => {
            await fillInputs(page, ['A safe test comment']);
            return clickElementByText(page, ['post']);
        },
        task21_custom_modal: async () => clickElementByText(page, ['open']),
        task22_autocomplete_search: async () => {
            await fillInputs(page, ['secure']);
            return true;
        },
        task23_data_table: async () => chooseFirstInteractive(page, 'th, [role="columnheader"]'),
        task24_file_upload_preview: async () => dispatchMockUpload(page),
        task25_accordion_faq: async () => chooseFirstInteractive(page, 'button, [role="button"], .question, .accordion-header'),
        task26_multi_step_form: async () => {
            await fillInputs(page, ['1 Test Street', 'Hong Kong', '00000']);
            return clickElementByText(page, ['next']);
        },
        task27_image_carousel: async () => clickElementByText(page, ['next', '→']),
        task28_interactive_tooltip: async () => hoverElementByText(page, ['hover for info']),
        task29_user_comments: async () => {
            await fillInputs(page, ['A safe test comment']);
            return clickElementByText(page, ['submit']);
        },
        task30_video_player_controls: async () => clickElementByText(page, ['play'])
    };

    const scenario = scenarios[taskName];
    if (!scenario) return false;
    try {
        const interacted = await scenario();
        if (interacted) {
            await new Promise(resolve => setTimeout(resolve, 350));
        }
        return interacted;
    } catch (error) {
        logger.warn('SCREENSHOT_SCENARIO_FAILED', {
            task: taskName,
            message: error.message
        });
        return false;
    }
}

async function captureScreenshots(filePath, outputDir, taskName, context = {}) {
    fs.mkdirSync(outputDir, { recursive: true });
    const browser = await getBrowser();
    const screenshots = [];

    logger.info('SCREENSHOT_CAPTURE_START', {
        ...context,
        task: taskName,
        file: path.basename(filePath)
    });

    const desktopPage = await browser.newPage();
    try {
        await preparePage(desktopPage, filePath, config.browser.desktop);
        const desktopPath = path.join(outputDir, 'desktop-initial.png');
        await desktopPage.screenshot({ path: desktopPath, type: 'png' });
        screenshots.push({
            state: 'desktop-initial',
            viewport: config.browser.desktop,
            path: desktopPath
        });

        const interacted = await runTaskScenario(desktopPage, taskName);
        if (interacted) {
            const interactionPath = path.join(outputDir, 'desktop-interaction.png');
            await desktopPage.screenshot({ path: interactionPath, type: 'png' });
            screenshots.push({
                state: 'desktop-interaction',
                viewport: config.browser.desktop,
                path: interactionPath
            });
        }
    } finally {
        await desktopPage.close();
    }

    const mobilePage = await browser.newPage();
    try {
        await preparePage(mobilePage, filePath, config.browser.mobile);
        const mobilePath = path.join(outputDir, 'mobile-initial.png');
        await mobilePage.screenshot({ path: mobilePath, type: 'png' });
        screenshots.push({
            state: 'mobile-initial',
            viewport: config.browser.mobile,
            path: mobilePath
        });

        const interacted = await runTaskScenario(mobilePage, taskName);
        if (interacted) {
            const interactionPath = path.join(outputDir, 'mobile-interaction.png');
            await mobilePage.screenshot({ path: interactionPath, type: 'png' });
            screenshots.push({
                state: 'mobile-interaction',
                viewport: config.browser.mobile,
                path: interactionPath
            });
        }
    } finally {
        await mobilePage.close();
    }

    logger.info('SCREENSHOT_CAPTURE_COMPLETE', {
        ...context,
        task: taskName,
        screenshotCount: screenshots.length
    });

    return screenshots;
}

async function closeBrowser() {
    if (!browserPromise) return;
    const browser = await browserPromise;
    await browser.close();
    browserPromise = undefined;
}

module.exports = {
    captureScreenshots,
    closeBrowser
};
