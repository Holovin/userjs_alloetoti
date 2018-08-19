// ==UserScript==
// @name         ALLO ETO TI?
// @namespace    http://holov.in/allo
// @version      0.0.1
// @description  TI GDE?
// @author       Alexander Holovin
// @match        https://vk.com/im?peers=*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const CHECK_EVERY = 3;

    let lastText = '';
    let lastMessageId = -1;
    let starterHandler;
    let latestBalance = '?';
    let isRecordStarted = false;
    let updatesCount = 0;

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

        const inputBlock = target.querySelector('div.im_editable');
        inputBlock.contentEditable = false;
        inputBlock.style.background = '#f1f8e9';

        const messages = document.querySelectorAll('li.im-mess');

        processMessage(messages[messages.length - 1]);
        startObserver();
    }

    function refreshKeyboard(action, payload) {
        console.warn(`[MU] Start ${action} (${isRecordStarted}) payload: `, payload);

        const buttons = target.querySelectorAll('div.Keyboard Button');
        const startWhichCode = 49; // 1 on keyboard and +1 to next right

        buttons.forEach((button, index) => {
            if (!button.textContent.startsWith('[')) {
                button.textContent = `[${index + 1}] ${button.textContent}`;
            }

            if (button.textContent.includes('Баланс')) {
                button.textContent = `Баланс (${latestBalance})`;
                button.disabled = true;
            }
        });

        switch (action) {
            case 'Ещё!': {
                if (updatesCount >= CHECK_EVERY) {
                    updatesCount = 0;

                    buttons.forEach(button => {
                        if (button.textContent.includes('Баланс')) {
                            button.disabled = false;
                            button.click();
                            return;
                        }
                    });

                }

                updatesCount++;
                buttons.forEach(button => {
                    if (button.textContent.includes('Ещё!')) {
                        button.click();
                        return;
                    }
                });
            }

            default: {
                document.addEventListener('keydown', e => {
                    const buttonIndex = e.which - startWhichCode;

                    // handle keyboard
                    if (e.which >= 49 && e.which <= 57 && buttonIndex < buttons.length && buttonIndex >= 0) {
                        buttons[buttonIndex].click();

                        refreshKeyboard();
                        stopEvent(e);
                        return;
                    }

                    // voice records/stop
                    if (e.which === 192) {
                        if (payload) {
                            // when player is active - two buttons exist
                            const playButtons = payload.querySelectorAll('button.audio-msg-track--btn');
                            console.warn('Buttons: ', playButtons);

                            playButtons[playButtons.length - 1].click();

                        } else {
                            if (!isRecordStarted) {
                                recordButton.click();
                            } else {
                                cancelButton.click();
                            }

                            isRecordStarted = !isRecordStarted;
                        }

                        refreshKeyboard('', payload);
                        stopEvent(e);
                        return;
                    }

                    // send?
                    if (e.which === 13) {
                        isRecordStarted = false;
                        sendButton.click();

                        stopEvent(e);
                        return;
                    }

                    if (e.which === 27) {
                        isRecordStarted = false;
                    }

                    // restart if miss key
                    refreshKeyboard(action, payload);
                    return;

                }, { capture: true, once: true })
            }
        }
    }

    function stopEvent(e) {
        console.log('[MU] Stop event: ', e);
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

                console.log('[MU]', mutation);
                processMessage(mutation.target);
            });
        });

        observer.observe(target, config);
    }

    function processMessage(mutation) {
        const messageTextBlock = mutation.querySelector('div.im-mess--text');
        console.warn('[MU]', messageTextBlock.innerText);

        const messageThanks = 'Спасибо, сейчас попробую использовать эту команду!';
        const messageCool = 'Крутой трек, надо добавить в свой плейлист!';
        const messageFail = 'Очень жаль! Может, тогда ты запишешь это просьбу для проигрывателя?';
        const messageMore = 'Если ты готов записать для теслаплеера еще одно сообщение, нажми кнопку "Еще!"';
        const messagePCheck = 'А пока, если ты не против, еще одна просьба. Я не уверен, что одно из голосовых верное. Мог бы ты послушать запись и сказать, дословно верный ли звучит текст? Я просил записать этот: ';
        const messagePRecord = 'Проигрыватель понимает только голосовую команду, пожалуйста запиши голосовое сообщение со следующим текстом: ';
        const messagePBalance = 'Твой баланс '

        // ok after recording
        if (messageTextBlock.innerText.startsWith(messageThanks)) {
            messageTextBlock.innerText = 'Проверить: ';
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
            messageTextBlock.innerText = ' ';
            refreshKeyboard('Ещё!');
            return;
        }

        // balance (parse)
        if (messageTextBlock.innerText.startsWith(messagePBalance)) {
            latestBalance = messageTextBlock.innerText.split(' ')[2];
            refreshKeyboard();
            return;
        }

        // its media?
        refreshKeyboard('', messageTextBlock);
    }

    // TODO: use disconnect? or nvm and just close tab?!
})();
