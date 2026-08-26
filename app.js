// إدارة الحالة المؤقتة (State)
let currentChatId = Date.now().toString();
let chatsHistory = JSON.parse(localStorage.getItem('nivo_chats') || '{}');
let activeAttachment = null;

// تهيئة أولية عند تشغيل الواجهة
document.addEventListener('DOMContentLoaded', () => {
    renderHistoryList();
    loadChat(currentChatId);
});

// 1. إدارة القائمة الجانبية وسجل المحادثات
function startNewChat() {
    currentChatId = Date.now().toString();
    removeAttachment();
    const messagesWrapper = document.getElementById('messagesWrapper');
    messagesWrapper.innerHTML = '';
    document.getElementById('welcomeScreen').style.display = 'block';
}

function renderHistoryList() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    
    Object.keys(chatsHistory).reverse().forEach(id => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <span><i class="fa-regular fa-message" style="margin-left: 6px;"></i> ${chatsHistory[id].title}</span>
            <i class="fa-solid fa-trash" onclick="deleteChat(event, '${id}')" style="font-size: 11px; opacity: 0.6;"></i>
        `;
        item.onclick = () => loadChat(id);
        historyList.appendChild(item);
    });
}

function loadChat(id) {
    currentChatId = id;
    const messagesWrapper = document.getElementById('messagesWrapper');
    const welcomeScreen = document.getElementById('welcomeScreen');
    messagesWrapper.innerHTML = '';

    if (chatsHistory[id] && chatsHistory[id].messages.length > 0) {
        welcomeScreen.style.display = 'none';
        chatsHistory[id].messages.forEach(msg => {
            appendMessageUI(msg.role, msg.content, msg.attachment);
        });
    } else {
        welcomeScreen.style.display = 'block';
    }
}

function deleteChat(event, id) {
    event.stopPropagation();
    delete chatsHistory[id];
    localStorage.setItem('nivo_chats', JSON.stringify(chatsHistory));
    if (currentChatId === id) startNewChat();
    renderHistoryList();
}

// 2. التحكم في حقل الكتابة والتمدد التلقائي
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// 3. إدارة إرفاق الملفات المدمج
function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    activeAttachment = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type
    };

    document.getElementById('fileName').innerText = `${activeAttachment.name} (${activeAttachment.size})`;
    document.getElementById('attachmentPreview').style.display = 'flex';
}

function removeAttachment() {
    activeAttachment = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('attachmentPreview').style.display = 'none';
}

// 4. إرسال وعرض الرسائل
function sendMessage() {
    const inputField = document.getElementById('userInput');
    const text = inputField.value.trim();
    const model = document.getElementById('modelSelect').value;

    if (!text && !activeAttachment) return;

    // إخفاء الشاشة الترحيبية
    document.getElementById('welcomeScreen').style.display = 'none';

    // حفظ وإظهار رسالة المستخدم
    const userMessageData = {
        role: 'user',
        content: text,
        attachment: activeAttachment ? { ...activeAttachment } : null
    };

    appendMessageUI('user', text, activeAttachment);
    saveMessageToHistory(userMessageData, text);

    // تصفير الحقل
    inputField.value = '';
    inputField.style.height = 'auto';
    removeAttachment();

    // رسالة محاكاة رد النظام التجريبي في لوحة المعاينة
    const loadingId = 'loading-' + Date.now();
    appendMessageUI('assistant', '<i class="fa-solid fa-spinner fa-spin"></i> جاري توليد الرد...', null, loadingId);

    setTimeout(() => {
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            const previewReply = `[معاينة وضع ${model}]: تم استلام طلبك بنجاح. الواجهة جاهزة بالكامل لربط استدعاء السيرفر عند التنفيذ.`;
            loadingElement.innerHTML = previewReply;
            saveMessageToHistory({ role: 'assistant', content: previewReply });
        }
    }, 1000);
}

function appendMessageUI(role, text, attachment = null, elementId = null) {
    const messagesWrapper = document.getElementById('messagesWrapper');
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    if (elementId) row.id = elementId;

    let attachmentHtml = '';
    if (attachment) {
        attachmentHtml = `
            <div style="font-size: 12px; background: rgba(255,255,255,0.08); padding: 4px 8px; border-radius: 6px; margin-bottom: 6px; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-paperclip"></i>
                <span>${attachment.name}</span>
            </div><br>
        `;
    }

    row.innerHTML = `
        <div class="message-bubble">
            ${attachmentHtml}
            <div>${text}</div>
        </div>
    `;

    messagesWrapper.appendChild(row);
    document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight;
}

function saveMessageToHistory(msgObj, fallbackTitle = '') {
    if (!chatsHistory[currentChatId]) {
        chatsHistory[currentChatId] = {
            title: fallbackTitle.slice(0, 24) || 'محادثة جديدة',
            messages: []
        };
    }
    chatsHistory[currentChatId].messages.push(msgObj);
    localStorage.setItem('nivo_chats', JSON.stringify(chatsHistory));
    renderHistoryList();
}
