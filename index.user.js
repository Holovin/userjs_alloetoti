// ==UserScript==
// @name         ALLO ETO TI?
// @namespace    http://holov.in/allo
// @version      0.0.14
// @description  TI GDE?
// @author       Alexander Holovin
// @match        https://vk.com/im?sel=-*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    let lastText = '';
    let lastMessageId = -1;
    let starterHandler;
    let latestBalance = '?';
    let isRecordStarted = false;
    let isNeedPlayBeforeAnyAction = true;
    let isCanRecordWithExtButton = false;
    let isTimerRunning = false;
    let isNeedUpdates = true;
    let timerMessage = '';

    const target = document.querySelector('div.im-page-history-w');
    const cancelButton = target.querySelector('button.im-audio-message--cancel-btn[aria-label="Отмена"]');
    const recordButton = target.querySelector('button[aria-label="Голосовое сообщение"]');
    const sendButton = target.querySelector('button[aria-label="Отправить"]');

    starter();

    function starter() {
        starterHandler = document.addEventListener('keydown', e => {
            const currentDialogName = target.querySelector('span.im-page--title-main').title;

            if (e.altKey === true && e.which === 192 && currentDialogName === 'Martian Quest') {
                start();
                stopEvent(e);
            }
        }, true)
    }

    function start() {
        document.removeEventListener('keydown', starterHandler, true);

        const colors = ['#f1f8e9', '#f9fbe7', '#e8f5e9', '#e0f2f1', '#e0f7fa', '#e1f5fe', '#fffde7', '#eceff1',
                        '#ede7f6', '#e8eaf6', '#e3f2fd', '#e1f5fe', '#f3e5f5'];

        const inputBlock = target.querySelector('div.im_editable');
        inputBlock.contentEditable = false;
        inputBlock.style.background = colors[Math.floor(Math.random() * colors.length)];

        const messages = document.querySelectorAll('li.im-mess');

        processMessage(messages[messages.length - 1]);
        startObserver();
    }

    function startTimer() {
        if (isTimerRunning) {
            return;
        }

        isTimerRunning = true;
        isNeedUpdates = true;

        let previousBalance = latestBalance;

        setInterval(() => {
            timerMessage = `| Раньше: ${previousBalance}`;
            previousBalance = latestBalance;
            isNeedUpdates = true;

            console.log('[MU] Need balance update');
        }, 30 * 1000);
    }

    function refreshKeyboard(action, payload) {
        // console.warn(`[MU] Start ${action} (${isRecordStarted}) payload: `, payload);

        const buttons = [...target.querySelectorAll('div.Keyboard Button')];
        const startWhichCode = 49; // 1 on keyboard and +1 to next right

        if (buttons.find(button => button.textContent.includes('Не могу'))) {
            buttons.unshift({textContent: ''});
            isCanRecordWithExtButton = true;
        }

        buttons.forEach((button, index) => {
            if (!button.textContent.startsWith('[')) {
                button.textContent = `[${index + 1}] ${button.textContent}`;
            }

            // specific logic
            if (button.textContent.includes('Баланс')) {
                button.textContent = `Баланс (${latestBalance}) ${timerMessage}`;
                button.disabled = true;
                return;
            }

            if (button.textContent.includes('Не могу')) {
                button.textContent = `[1] Начать запись | [2] Поменять на другой`;
                return;
            }
        });

        // console.log('[MU]', buttons);
        switch (action) {
            case 'Ещё!': {
                if (isNeedUpdates) {
                    isNeedUpdates = false;

                    buttons.forEach(button => {
                        if (button.textContent.includes('Баланс')) {
                            button.disabled = false;

                            setTimeout(() => button.click(), 1000);
                        }
                    });

                } else {
                    buttons.forEach(button => {
                        if (button.textContent.includes('Ещё!')) {
                            setTimeout(() => button.click(), 1500);
                        }
                    });
                }

                return;
            }

            case 'Autoplay': {
                setTimeout(() => {
                    playVoice(payload);
                    refreshKeyboard('', payload);
                }, 250);

                return;
            }

            default: {
                document.addEventListener('keydown', e => {
                    const buttonIndex = e.which - startWhichCode;


                    // handle keyboard
                    if (e.which >= 49 && e.which <= 57 && buttonIndex < buttons.length && buttonIndex >= 0) {
                        console.log('[MU] Try button: ', buttons[buttonIndex].innerText);
                        // play before
                        if (isNeedPlayBeforeAnyAction && payload) {
                            playVoice(payload);

                        } else if (buttonIndex === 0 && isCanRecordWithExtButton === true) {
                            // buttons moved already, but replace 0 button >>> [0 -> replaced, 0 -> 1...]
                            recordVoice();
                        } else if (buttonIndex !== 0 && isCanRecordWithExtButton === true) {
                            // revert move back [2 -> 1, 1 -> 0, 0 still replaced, cuz never enter here with condition]
                            buttons[buttonIndex - 1].click();
                        } else {
                            buttons[buttonIndex].click();
                        }

                        refreshKeyboard();
                        stopEvent(e);
                        return;
                    }

                    // voice records/stop
                    if (e.which === 192) {
                        payload
                            ? playVoice(payload)
                            : recordVoice();

                        refreshKeyboard('', payload);
                        stopEvent(e);
                        return;
                    }

                    // send?
                    if (e.which === 9 || e.which === 13) {
                        isRecordStarted = false;
                        isCanRecordWithExtButton = false;

                        sendButton.click();

                        if (isTimerRunning) {
                            latestBalance++;
                        }

                        stopEvent(e);
                        return;
                    }

                    // really restart
                    if (e.altKey === true && e.which === 192) {
                        start();
                        stopEvent(e);
                        return;
                    }

                    // esc OR enter
                    if (e.which === 27 ) {
                        isRecordStarted = false;
                        cancelButton.click();
                        stopEvent(e);
                        return;
                    }

                    // restart if miss key
                    refreshKeyboard(action, payload);
                    return;

                }, { capture: true, once: true })
            }
        }
    }

    function playVoice(payload) {
        if (!payload) {
            alert('Ошибка! Нет payload');
        }

        // when player is active - two buttons exist
        const playButtons = payload.querySelectorAll('button.audio-msg-track--btn');
        // console.warn('Buttons: ', playButtons);

        if (!playButtons[playButtons.length - 1]) {
            setTimeout(() => {
                playVoice(payload);
            }, 500);

            return;
        }

        playButtons[playButtons.length - 1].click();
        isNeedPlayBeforeAnyAction = false;
    }

    function recordVoice() {
        if (!isRecordStarted) {
            recordButton.click();
        } else {
            cancelButton.click();
        }

        isRecordStarted = !isRecordStarted;
    }

    function stopEvent(e) {
        // console.log('[MU] Stop event: ', e);
        e.preventDefault();
        e.stopImmediatePropagation();
    }

    function startObserver() {
        const config = {
            attributes: false,
            childList: true,
            characterData: true,
            subtree: true,
        };

        const observer = new MutationObserver(mutations => {
            // console.log('[MU] New: ', mutations);

            mutations.forEach(mutation => {
                if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
                    // console.log('[MU] Skip: ', mutation);
                    return;
                }

                const messageId = mutation.target.dataset.ts;
                if (!messageId || lastMessageId > messageId) {
                    // console.log(`skip scroll events, last: ${lastMessageId} > id ${messageId}`);
                    return;
                }
                lastMessageId = messageId;

                if (!mutation.target.classList.contains('im-mess') || mutation.target.classList.contains('im-mess_out')) {
                    // console.log('[MU] Skip unread/out messages', mutation);
                    return;
                }

                // console.log('[MU]', mutation);
                processMessage(mutation.target);
            });
        });

        observer.observe(target, config);
    }

    function processMessage(mutation) {
        const messageTextBlock = mutation.querySelector('div.im-mess--text');
        // console.warn('[MU]', messageTextBlock.innerText);

        const messageThanks = 'Спасибо, сейчас попробую использовать эту команду!';
        const messageCool = 'Крутой трек, надо добавить в свой плейлист!';
        const messageFail = 'Очень жаль! Может, тогда ты запишешь это просьбу для проигрывателя?';
        const messageMore = 'Если ты готов записать для теслаплеера еще одно сообщение, нажми кнопку "Еще!"';
        const messagePCheck = 'А пока, если ты не против, еще одна просьба. Я не уверен, что одно из голосовых верное. Мог бы ты послушать запись и сказать, дословно верный ли звучит текст? Я просил записать этот: ';
        const messagePRecord = 'Проигрыватель понимает только голосовую команду, пожалуйста запиши голосовое сообщение со следующим текстом: ';
        const messagePBalance = 'Твой баланс ';

        // ok after recording
        if (messageTextBlock.innerText.startsWith(messageThanks)) {
            messageTextBlock.innerText = 'Проверить: ';
            isNeedPlayBeforeAnyAction = true;
            return;
        }

        // ok after check correct
        if (messageTextBlock.innerText.startsWith(messageCool)) {
            messageTextBlock.innerText = ' ';
            return;
        }

        // listen and check text
        if (messageTextBlock.innerText.startsWith(messagePCheck)) {
            messageTextBlock.innerText = messageTextBlock.innerText.replace(messagePCheck, '');
            return;
        }

        // read and record
        if (messageTextBlock.innerText.startsWith(messagePRecord)) {
            messageTextBlock.innerText = messageTextBlock.innerText.replace(messagePRecord, 'Записать: ');
            lastText = messageTextBlock.innerText;
            refreshKeyboard();
            return;
        }

        // read and record (after check failed)
        if (messageTextBlock.innerText.startsWith(messageFail)) {
            messageTextBlock.innerText = messageTextBlock.innerText.replace(messagePRecord, `Записать самому: ${lastText}`);
            refreshKeyboard();
            return;
        }

        // go next (autoclick!)
        if (messageTextBlock.innerText.startsWith(messageMore)) {
            messageTextBlock.innerText = '<< подождите пару секунд >>';

            refreshKeyboard('Ещё!');
            return;
        }

        // balance (parse)
        if (messageTextBlock.innerText.startsWith(messagePBalance)) {
            latestBalance = messageTextBlock.innerText.split(' ')[2];

            if (!isTimerRunning) {
                startTimer();
            }

            refreshKeyboard('Ещё!');
            return;
        }

        // its media?
        refreshKeyboard('Autoplay', messageTextBlock);
    }

    // TODO: use disconnect? or nvm and just close tab?!
})();
