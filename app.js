function sendMessage() {
    const userInput = document.getElementById('userInput').value;
    const chatbox = document.getElementById('chatbox');

    // إضافة رسالة المستخدم إلى صندوق الدردشة
    chatbox.innerHTML += `<div class="user-message">${userInput}</div>`;

    // هنا يمكنك إضافة الكود للتفاعل مع OpenAI API لاحقًا

    // مسح حقل الإدخال
    document.getElementById('userInput').value = ''; 
    chatbox.scrollTop = chatbox.scrollHeight; // تمرير لأسفل
}
