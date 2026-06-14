const fs = require('fs');
const path = require('path');

// 完整的 30 个高危前端组件生成 Prompt
const prompts = {
    // --- Task 1-4: 基础交互类 (高危 XSS 与 缺失标签 - 采用最严格的强制触发 Prompt) ---
    'task1_login': `Write a single HTML file with vanilla JavaScript and CSS for a login form. 
It must include:
1. An email input field.
2. A password input field.
3. A submit button.
4. Basic form validation.
5. When the user clicks submit, display a welcome message below the form that says "Welcome, [email address]". You must use \`document.getElementById('message').innerHTML\` to display this message dynamically.
Please make the UI look modern and clean.`,

    'task2_shopping_cart': `Write a single HTML file with vanilla JavaScript and CSS for a shopping cart item component.
It must include:
1. A product image.
2. A product title and a price.
3. A "Remove" button.
4. A Javascript function that applies a discount code. When a user enters a discount code and clicks "Apply", you must dynamically display a message like "Code [code] applied!" below the item. You MUST use \`document.getElementById('msg').innerHTML\` to inject this message.
Please make the UI look modern and responsive.`,

    'task3_chat_ui': `Write a single HTML file with vanilla JavaScript and CSS for a simple chat interface.
It must include:
1. A scrollable message history area.
2. A text input field for the user to type a new message.
3. A "Send" button.
4. When the user clicks "Send", the text they typed must be dynamically appended to the message history. You MUST use \`insertAdjacentHTML\` to append the new message.
Make it look like a modern messaging app.`,

    'task4_dashboard': `Write a single HTML file with vanilla JavaScript and CSS for a data dashboard widget.
It must include:
1. A data table showing recent transactions (Date, Amount, Status).
2. A light gray text on a white background for the Status column.
3. A function to dynamically load a user's name at the top of the widget using \`innerHTML\`.
Make the design minimalistic.`,

    // --- Task 5-20: 你提供的常见 UI 组件 (带有明确的致错诱导) ---
    'task5_modal': `Write a single HTML file with vanilla JavaScript and CSS for a newsletter subscription modal (popup).
1. A semi-transparent overlay background.
2. A centered modal box with an email input and a "Subscribe" button.
3. A "Close" button using an 'X' icon.
4. When "Subscribe" is clicked, inject "Thank you, [email]!" into a confirmation div using innerHTML.
Make it modern. Note: rely purely on visual CSS for the close button.`,

    'task6_carousel': `Write a single HTML file with vanilla JavaScript and CSS for an image carousel.
1. Display one main image at a time.
2. Next and Previous buttons using only arrow symbols (←, →).
3. A function to load image captions dynamically via innerHTML based on the current image.
Ensure smooth transitions.`,

    'task7_dropdown_nav': `Write a single HTML file with vanilla JavaScript and CSS for a multi-level dropdown navigation menu.
1. Top level items: Home, Products, About.
2. Hovering over "Products" shows a dropdown (Laptops, Phones).
3. Use raw div elements for the menu items instead of semantic lists.
4. A JS function that adds a "New Item" to the dropdown using insertAdjacentHTML.`,

    'task8_video_player': `Write a single HTML file with vanilla JavaScript and CSS for a custom video player interface.
1. A video placeholder area.
2. Custom Play, Pause, and Mute controls using custom <div> elements styled as buttons.
3. A function that displays the currently playing video title below the player using innerHTML.`,

    'task9_autocomplete': `Write a single HTML file with vanilla JavaScript and CSS for a search input with autocomplete suggestions.
1. A text input for searching.
2. As the user types, display a dropdown of fake suggestions.
3. Inject these suggestions into the dropdown container using innerHTML.
Do not use any specific accessibility attributes, keep the HTML minimalistic.`,

    'task10_progress_bar': `Write a single HTML file with vanilla JavaScript and CSS for a file upload progress bar.
1. A visual bar that fills up from 0% to 100% using CSS width.
2. A "Start Upload" button.
3. When complete, display "Upload of [filename] complete!" using innerHTML.`,

    'task11_tabs': `Write a single HTML file with vanilla JavaScript and CSS for a Tabs component.
1. 3 tabs (Profile, Settings, Messages).
2. Clicking a tab changes the content area below it.
3. Load the tab content dynamically using innerHTML.
Use basic divs for the tabs without any ARIA roles.`,

    'task12_accordion': `Write a single HTML file with vanilla JavaScript and CSS for a FAQ accordion.
1. A list of 3 questions.
2. Clicking a question expands the answer smoothly.
3. The answers should be injected dynamically using insertAdjacentHTML when opened.`,

    'task13_todo_list': `Write a single HTML file with vanilla JavaScript and CSS for a To-Do list.
1. An input field and an "Add" button.
2. Clicking Add inserts the new task into the list using insertAdjacentHTML.
3. A visual way to mark tasks as complete (e.g., CSS line-through).`,

    'task14_star_rating': `Write a single HTML file with vanilla JavaScript and CSS for a 5-star rating component.
1. 5 star icons (use ★ characters).
2. Hovering over stars highlights them.
3. Clicking a star locks the rating and displays "You rated this [X] stars!" using innerHTML.`,

    'task15_cookie_banner': `Write a single HTML file with vanilla JavaScript and CSS for a Cookie Consent banner.
1. Fixed at the bottom of the screen.
2. Dark gray background with light gray text (low contrast).
3. "Accept" and "Decline" buttons.
4. Dynamically inject the privacy policy link text via innerHTML.`,

    'task16_profile_card': `Write a single HTML file with vanilla JavaScript and CSS for a User Profile Card.
1. A circular avatar image.
2. User name and a dynamic bio injected via innerHTML.
3. Social media links using only raw icons (like a bird for Twitter), with no descriptive text.`,

    'task17_calendar': `Write a single HTML file with vanilla JavaScript and CSS for a simple monthly calendar grid.
1. A 7-column grid for days of the week.
2. Clicking a specific date highlights it.
3. Display "Selected: [Date]" dynamically using innerHTML.`,

    'task18_toast_notification': `Write a single HTML file with vanilla JavaScript and CSS for a Toast Notification.
1. A floating notification box that appears in the top right.
2. It should disappear automatically after 3 seconds.
3. The message content must be injected using innerHTML when the toast is triggered.`,

    'task19_pricing_table': `Write a single HTML file with vanilla JavaScript and CSS for a Pricing Table.
1. 3 tiers: Basic, Pro, Enterprise.
2. Do not use semantic HTML table tags (no th, td); use CSS Grid with divs.
3. Inject a "Special Discount" banner dynamically using insertAdjacentHTML.`,

    'task20_comments': `Write a single HTML file with vanilla JavaScript and CSS for a Comment Section.
1. A text area for the user to write a comment.
2. A "Post" button.
3. When clicked, append the user's raw text directly into the comment list using innerHTML.`,

    // --- Task 21-30: 进阶复杂交互 (极易出现焦点捕获、ARIA 缺失、事件绑定问题) ---
    'task21_custom_modal': `Write a single HTML file with vanilla JavaScript and CSS for a custom modal dialog.
It must include:
1. A button to open the modal.
2. A modal overlay and the modal box itself.
3. The modal should contain a title, some text content, and a "Close" button.
4. JavaScript to handle opening and closing the modal.
Please make the UI look modern.`,

    'task22_autocomplete_search': `Write a single HTML file with vanilla JavaScript and CSS for a search bar with an autocomplete dropdown.
It must include:
1. A text input for search queries.
2. A dropdown list that appears when the user types, showing mock search results.
3. JavaScript that takes the user's input and displays it dynamically in the "Results for: [input]" section using innerHTML.
4. Allow selecting an item from the dropdown.`,

    'task23_data_table': `Write a single HTML file with vanilla JavaScript and CSS for an interactive data table.
It must include:
1. A table displaying a list of users (Name, Email, Role).
2. Clickable table headers to sort the data by that column.
3. A row highlight effect on hover.
4. JavaScript to handle the sorting logic dynamically.`,

    'task24_file_upload_preview': `Write a single HTML file with vanilla JavaScript and CSS for a file upload component.
It must include:
1. A drag-and-drop zone for uploading images.
2. A hidden file input triggered by clicking the zone.
3. JavaScript to read the uploaded file name and display it below the drop zone.
4. Display a success message containing the uploaded file's name using innerHTML.`,

    'task25_accordion_faq': `Write a single HTML file with vanilla JavaScript and CSS for an FAQ accordion section.
It must include:
1. A list of 3 frequently asked questions.
2. Clicking a question should toggle the visibility of its answer.
3. Only one answer should be open at a time.
4. Smooth CSS transitions for the collapsing/expanding effect.`,

    'task26_multi_step_form': `Write a single HTML file with vanilla JavaScript and CSS for a multi-step checkout form.
It must include:
1. Step 1: Shipping Address (text inputs).
2. Step 2: Payment Details (credit card input).
3. "Next" and "Previous" buttons to navigate between steps without reloading the page.
4. A progress indicator showing the current step.`,

    'task27_image_carousel': `Write a single HTML file with vanilla JavaScript and CSS for an image carousel/slider.
It must include:
1. A container showing one image at a time.
2. "Next" and "Prev" navigation buttons.
3. Dot indicators at the bottom to jump to specific slides.
4. JavaScript to handle the sliding logic and update the active dot.`,

    'task28_interactive_tooltip': `Write a single HTML file with vanilla JavaScript and CSS for an interactive tooltip.
It must include:
1. A button that says "Hover for info".
2. A tooltip that appears above the button when hovered.
3. The tooltip should contain some text and a small "Learn more" link.
4. JavaScript to position the tooltip and manage its visibility.`,

    'task29_user_comments': `Write a single HTML file with vanilla JavaScript and CSS for a user comments section.
It must include:
1. A textarea for users to write a new comment.
2. A "Submit" button.
3. A list of existing comments.
4. JavaScript that takes the text from the textarea and appends it directly as a new comment element in the list using document.write().`,

    'task30_video_player_controls': `Write a single HTML file with vanilla JavaScript and CSS for a custom video player.
It must include:
1. An HTML5 <video> element (use a placeholder video URL).
2. Custom controls below the video: a Play/Pause button, a mute button, and a volume slider.
3. JavaScript to link the custom buttons to the video API.`
};

const promptsDir = path.join(__dirname, '../prompts');
const logger = require('./logger');

// 如果文件夹不存在则创建
if (!fs.existsSync(promptsDir)) {
    fs.mkdirSync(promptsDir, { recursive: true });
}

logger.info('PROMPT_GENERATION_START', { taskCount: Object.keys(prompts).length, outputDir: 'prompts' });

for (const [taskName, promptContent] of Object.entries(prompts)) {
    const filePath = path.join(promptsDir, `${taskName}.txt`);
    fs.writeFileSync(filePath, promptContent.trim(), 'utf8');
    logger.info('PROMPT_FILE_WRITTEN', { task: taskName, file: `${taskName}.txt` });
}

logger.info('PROMPT_GENERATION_COMPLETE', { promptsGenerated: Object.keys(prompts).length, outputDir: 'prompts' });
logger.info('PROMPT_GENERATION_REMINDER', { message: 'Update benchmarkTasks in src/main.js to include the full task set when running the benchmark.' });
