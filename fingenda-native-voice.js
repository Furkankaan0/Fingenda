(function () {
    const isNativeIOS = () => !!(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === 'ios');
    const getPlugin = () => window.Capacitor?.Plugins?.FingendaSpeechRecognition || null;

    const state = {
        listening: false,
        listenersBound: false,
        startedAt: 0
    };

    function nativeIOSSpeechEnabled() {
        if (!isNativeIOS()) return false;
        if (window.FINGENDA_NATIVE_IOS_SPEECH_ENABLED === true) return true;
        if (window.FINGENDA_NATIVE_IOS_SPEECH_ENABLED === false) return false;

        try {
            const storedPreference = window.localStorage?.getItem('fingenda_native_ios_speech');
            if (storedPreference === 'disabled') return false;
            if (storedPreference === 'enabled') return true;
        } catch (error) {
            console.warn('[Voice] Native iOS speech flag could not be read:', error);
        }

        return true;
    }

    function t(tr, en) {
        return window.FINGENDA_LANG === 'en' ? en : tr;
    }

    function setVoiceButton(listening) {
        const btn = document.getElementById('btn-voice-input');
        const btnText = document.getElementById('btn-voice-text');

        state.listening = !!listening;

        if (btn) {
            btn.classList.toggle('animate-pulse', listening);
            btn.classList.toggle('ring-2', listening);
            btn.classList.toggle('ring-red-500', listening);
            btn.classList.toggle('bg-red-50', listening);
            btn.classList.toggle('text-red-500', listening);
        }

        if (btnText) {
            btnText.setAttribute('data-i18n', listening ? 'transaction.listening' : 'transaction.voiceAdd');
            btnText.innerText = listening ? window.t('transaction.listening') : window.t('transaction.voiceAdd');
        }
    }

    function resetVoiceState() {
        setVoiceButton(false);
        window.currentRecognition = null;
    }

    function showVoiceError(message) {
        if (typeof window.alertMessage === 'function') {
            window.alertMessage(window.t('msg.error'), message, 'red');
            return;
        }

        if (typeof window.showMicroFeedback === 'function') {
            window.showMicroFeedback({ message, type: 'warning' });
            return;
        }

        window.alert?.(message);
    }

    function hasUsableNativePlugin(plugin) {
        return !!(
            plugin &&
            typeof plugin.startListening === 'function' &&
            typeof plugin.stopListening === 'function'
        );
    }

    function openVoiceFallback() {
        resetVoiceState();
        window.openTransactionVoiceFallbackPrompt?.();
    }

    async function ensureNativeListeners(plugin) {
        if (state.listenersBound || !plugin?.addListener) return;

        const onResult = async (payload) => {
            const transcript = (payload?.transcript || '').trim();
            if (!transcript) return;

            if (payload?.isFinal) {
                resetVoiceState();
                window.applyTransactionVoiceTranscript?.(transcript);
            }
        };

        const onState = async (payload) => {
            const nextState = payload?.state;
            if (!nextState) return;

            if (nextState === 'listening') {
                state.startedAt = Date.now();
                setVoiceButton(true);
                return;
            }

            if (nextState === 'permissionDenied') {
                resetVoiceState();
                showVoiceError(t('Mikrofon veya ses tanıma izni verilmedi. iPhone Ayarlar ekranından izinleri açabilirsiniz.', 'Microphone or speech recognition permission was denied. You can enable it in iPhone Settings.'));
                return;
            }

            if (nextState === 'unavailable') {
                resetVoiceState();
                showVoiceError(t('Ses tanıma bu cihazda veya seçili dilde şu an kullanılamıyor.', 'Speech recognition is not available on this device or for the selected language right now.'));
                return;
            }

            if (nextState === 'error') {
                resetVoiceState();
                const message = payload?.message || t('Ses tanıma başlatılamadı. Lütfen tekrar deneyin.', 'Voice recognition could not start. Please try again.');
                showVoiceError(message);
                return;
            }

            if (nextState === 'stopped' || nextState === 'completed') {
                resetVoiceState();
            }
        };

        await plugin.addListener('speechResult', onResult);
        await plugin.addListener('speechState', onState);
        state.listenersBound = true;
    }

    async function startNativeVoiceInput() {
        if (!nativeIOSSpeechEnabled()) {
            openVoiceFallback();
            return;
        }

        const plugin = getPlugin();
        if (!hasUsableNativePlugin(plugin)) {
            openVoiceFallback();
            return;
        }

        try {
            await ensureNativeListeners(plugin);
        } catch (error) {
            console.error('[Voice] Native listener binding failed:', error);
            openVoiceFallback();
            return;
        }

        if (state.listening) {
            try {
                await plugin.stopListening();
            } catch (error) {
                console.error('[Voice] Native stop failed:', error);
            } finally {
                resetVoiceState();
            }
            return;
        }

        try {
            const locale = window.FINGENDA_LANG === 'en' ? 'en-US' : 'tr-TR';
            if (typeof plugin.getAvailability !== 'function') {
                setVoiceButton(true);
                await plugin.startListening({ locale });
                window.currentRecognition = { abort: () => plugin.stopListening() };
                return;
            }

            const availability = await plugin.getAvailability({ locale });
            if (availability?.available === false) {
                const reason = availability?.reason || t('Ses tanıma şu an kullanılamıyor.', 'Speech recognition is currently unavailable.');
                showVoiceError(reason);
                openVoiceFallback();
                return;
            }

            setVoiceButton(true);
            await plugin.startListening({ locale });
            window.currentRecognition = { abort: () => plugin.stopListening() };
        } catch (error) {
            console.error('[Voice] Native start failed:', error);
            resetVoiceState();
            const message = error?.message || t('Sesle ekleme başlatılamadı. Lütfen tekrar deneyin.', 'Voice entry could not start. Please try again.');
            showVoiceError(message);
        }
    }

    function installNativeVoiceOverride() {
        if (!isNativeIOS()) return;

        const originalStartTransactionVoiceInput = window.startTransactionVoiceInput;

        if (!nativeIOSSpeechEnabled()) {
            window.startTransactionVoiceInput = function startTransactionVoiceInputIOSFallback() {
                resetVoiceState();
                if (typeof window.openTransactionVoiceFallbackPrompt === 'function') {
                    return window.openTransactionVoiceFallbackPrompt();
                }
                if (typeof originalStartTransactionVoiceInput === 'function') {
                    return originalStartTransactionVoiceInput();
                }
                return false;
            };
            return;
        }

        window.startTransactionVoiceInput = function startTransactionVoiceInputNative() {
            if (!hasUsableNativePlugin(getPlugin())) {
                if (typeof originalStartTransactionVoiceInput === 'function') {
                    return originalStartTransactionVoiceInput();
                }
                return window.openTransactionVoiceFallbackPrompt?.();
            }

            return startNativeVoiceInput();
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installNativeVoiceOverride);
    } else {
        installNativeVoiceOverride();
    }

    setTimeout(installNativeVoiceOverride, 0);
})();
