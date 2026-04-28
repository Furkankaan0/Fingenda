(() => {
        const APPLE_AUTH_KEYS = ['apple_user_id', 'apple_email', 'apple_full_name', 'apple_identity_token', 'apple_authorization_code', 'auth_provider'];
        const isEnglish = () => (window.FINGENDA_LANG || localStorage.getItem('fingenda_language') || '').toLowerCase().startsWith('en');
        const text = (tr, en) => isEnglish() ? en : tr;
        const getPlugin = () => window.Capacitor?.Plugins?.FingendaAppleAuth || null;
        const alertUser = (title, message, color = 'blue') => {
            if (typeof window.alertMessage === 'function') window.alertMessage(title, message, color);
            else alert(`${title}\n${message}`);
        };

        function normalizeAppleName(result) {
            const fullName = String(result?.fullName || '').trim();
            if (fullName) return fullName;
            return [String(result?.givenName || '').trim(), String(result?.familyName || '').trim()].filter(Boolean).join(' ').trim();
        }

        function getAppleAccount() {
            const userId = localStorage.getItem('apple_user_id') || '';
            if (!userId) return null;
            return {
                userId,
                email: localStorage.getItem('apple_email') || '',
                fullName: localStorage.getItem('apple_full_name') || ''
            };
        }

        function applyAppleAccount(result) {
            if (!result || !result.user) return null;
            const fullName = normalizeAppleName(result) || localStorage.getItem('apple_full_name') || '';
            const email = String(result.email || localStorage.getItem('apple_email') || '').trim();

            localStorage.setItem('apple_user_id', result.user);
            localStorage.setItem('auth_provider', 'apple');
            if (email) localStorage.setItem('apple_email', email);
            if (fullName) {
                localStorage.setItem('apple_full_name', fullName);
                localStorage.setItem('user_name', fullName);
            }
            if (result.identityToken) localStorage.setItem('apple_identity_token', result.identityToken);
            if (result.authorizationCode) localStorage.setItem('apple_authorization_code', result.authorizationCode);

            const profileName = document.getElementById('profile-name');
            if (profileName && fullName) profileName.value = fullName;

            if (typeof window.updateProfileUI === 'function') {
                window.updateProfileUI(localStorage.getItem('user_name') || window.getDefaultGuestName?.() || 'Misafir', null, localStorage.getItem('user_avatar'));
            }
            window.renderAppleAccountStatus?.();
            return getAppleAccount();
        }

        async function signInWithApple() {
            const plugin = getPlugin();
            if (!plugin || typeof plugin.signIn !== 'function') {
                alertUser(text('Apple ile giriş', 'Sign in with Apple'), text('Apple ile giriş yalnızca iOS uygulaması içinde kullanılabilir.', 'Sign in with Apple is available inside the iOS app.'), 'yellow');
                return null;
            }
            try {
                const result = await plugin.signIn();
                if (!result || result.cancelled) return null;
                const account = applyAppleAccount(result);
                if (account) alertUser(text('Apple hesabı bağlandı', 'Apple account connected'), text('Profilin Apple ile güvenli şekilde bağlandı.', 'Your profile is securely connected with Apple.'), 'green');
                return account;
            } catch (error) {
                console.error('[AppleAuth] signIn failed:', error);
                alertUser(text('Apple ile giriş başarısız', 'Apple sign-in failed'), text('Apple oturumu açılamadı. Lütfen tekrar deneyin.', 'Apple sign-in could not be completed. Please try again.'), 'red');
                return null;
            }
        }

        window.FingendaAppleAuth = {
            getAccount: getAppleAccount,
            signIn: signInWithApple,
            applyAccount: applyAppleAccount,
            isAvailable: () => !!getPlugin()?.signIn,
            clearLocalAccount() {
                APPLE_AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
                window.renderAppleAccountStatus?.();
            }
        };

        window.renderAppleAccountStatus = function renderAppleAccountStatus() {
            const card = document.getElementById('apple-account-card');
            if (!card) return;
            const titleEl = document.getElementById('apple-account-title');
            const subtitleEl = document.getElementById('apple-account-subtitle');
            const actionEl = document.getElementById('apple-account-action');
            const account = getAppleAccount();
            const connected = !!account;
            card.setAttribute('data-apple-state', connected ? 'connected' : 'disconnected');
            if (titleEl) titleEl.textContent = connected ? text('Apple ile bağlı', 'Connected with Apple') : text('Apple hesabı bağlı değil', 'Apple account not connected');
            if (subtitleEl) subtitleEl.textContent = connected ? (account.email || account.fullName || text('Gizli Apple e-postası', 'Private Apple email')) : text('Apple hesabını bağlayarak profilini güvenle senkronize et.', 'Connect your Apple account to keep your profile secure.');
            if (actionEl) actionEl.textContent = connected ? text('Bağlantıyı Kes', 'Disconnect') : text('Apple ile Bağlan', 'Connect with Apple');
        };

        window.disconnectAppleAccount = function disconnectAppleAccount() {
            const run = () => {
                window.FingendaAppleAuth.clearLocalAccount();
                alertUser(text('Bağlantı kesildi', 'Disconnected'), text('Apple hesabı bu cihazdaki Fingenda profilinden ayrıldı.', 'Apple account was disconnected from this Fingenda profile on this device.'), 'blue');
            };
            if (typeof window.openConfirmModal === 'function') {
                window.openConfirmModal({
                    title: text('Apple bağlantısını kes', 'Disconnect Apple account'),
                    message: text('Bu işlem sadece bu cihazdaki bağlantıyı kaldırır. Verilerin silinmez.', 'This only removes the local connection on this device. Your data will not be deleted.'),
                    confirmText: text('Bağlantıyı Kes', 'Disconnect'),
                    cancelText: text('Vazgeç', 'Cancel'),
                    variant: 'red',
                    onConfirm: run
                });
            } else if (confirm(text('Apple bağlantısını kesmek istiyor musun?', 'Disconnect Apple account?'))) {
                run();
            }
        };

        window.handleAppleAccountAction = function handleAppleAccountAction() {
            if (getAppleAccount()) {
                window.disconnectAppleAccount();
                return;
            }
            signInWithApple();
        };

        window.signInWithAppleFromOnboarding = async function signInWithAppleFromOnboarding() {
            const account = await signInWithApple();
            if (!account) return;
            localStorage.setItem('fingo_onboarding_completed', 'true');
            localStorage.setItem('fingo_intro_seen', 'true');
            if (window.fingoOnboarding && typeof window.fingoOnboarding.complete === 'function') window.fingoOnboarding.complete();
            else document.getElementById('fingo-onboarding')?.classList.add('fo-hidden');
        };

        document.addEventListener('DOMContentLoaded', () => window.renderAppleAccountStatus?.());
    })();
