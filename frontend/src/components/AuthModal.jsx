import { useEffect, useState } from 'react';
import { auth, provider, signInWithPopup } from '../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { toast } from 'sonner';
import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader } from './ui/ModalElements';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

export default function AuthModal({ isOpen, onClose, initialMode = 'login', onLoginSuccess }) {
    const [mode, setMode] = useState(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [verificationSent, setVerificationSent] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
            setError(null);
            setEmail('');
            setPassword('');
            setFullName('');
            setVerificationSent(false);
        }
    }, [isOpen, initialMode]);

    const isLogin = mode === 'login';

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await signInWithPopup(auth, provider);
            const idToken = await result.user.getIdToken();
            const refCode = localStorage.getItem('referralCode');
            const response = await fetch('/api/auth/firebase-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_token: idToken, referral_code: refCode })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Error en autenticación con Google');

            if (onLoginSuccess) onLoginSuccess(data.user, data.access_token);
            toast.success(`¡Bienvenido ${data.user.full_name || ''}!`);
            onClose();
        } catch (err) {
            console.error(err);
            toast.error(err.message || 'Error al iniciar sesión con Google');
            setError(err.message || 'Error al iniciar sesión con Google');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!email) {
            toast.error('Por favor, ingresa tu correo electrónico en el campo superior.');
            setError('Ingresa tu correo antes de solicitar el cambio de contraseña.');
            return;
        }
        try {
            setLoading(true);
            await sendPasswordResetEmail(auth, email);
            toast.success('Correo de recuperación enviado. Revisa tu bandeja de entrada.');
            setError(null);
        } catch (err) {
            console.error(err);
            toast.error('Error al enviar el correo de recuperación.');
            setError('Error al enviar el correo. Verifica que esté bien escrito.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!isLogin) {
                const checkRes = await fetch(`/api/auth/check-disposable?email=${email}`);
                if (!checkRes.ok) {
                    const checkData = await checkRes.json();
                    throw new Error(checkData.detail || 'Email no válido');
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await sendEmailVerification(userCredential.user);
                await signOut(auth);
                setVerificationSent(true);
                return;
            }

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                if (!userCredential.user.emailVerified) {
                    await signOut(auth);
                    throw new Error('Debes verificar tu correo. Revisa tu bandeja de entrada.');
                }
                const token = await userCredential.user.getIdToken();
                const refCode = localStorage.getItem('referralCode');
                const response = await fetch('/api/auth/firebase-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_token: token, referral_code: refCode })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.detail || 'Error en login');

                if (onLoginSuccess) onLoginSuccess(data.user, data.access_token);
                onClose();
            } catch (loginErr) {
                if (loginErr.code === 'auth/wrong-password' || loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
                    throw new Error('Correo o contraseña incorrectos.');
                }
                throw loginErr;
            }
        } catch (err) {
            console.error(err);
            let msg = err.message;
            if (msg.includes('auth/email-already-in-use')) msg = 'El correo ya está registrado';
            if (msg.includes('auth/weak-password')) msg = 'La contraseña es muy débil (mínimo 6 caracteres)';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" panelClassName="overflow-hidden">
            <ModalCloseButton onClick={onClose} />

            <div className="space-y-5 p-5 pt-6">
                {verificationSent ? (
                    <>
                        <ModalHeader
                            title="Verifica tu correo"
                            description="Hemos enviado un enlace de verificación. Abre tu correo para activar tu cuenta y luego inicia sesión."
                            tone="info"
                            align="center"
                        />
                        <p className="break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {email}
                        </p>
                        <ModalButton
                            onClick={() => {
                                setVerificationSent(false);
                                setMode('login');
                            }}
                            variant="info"
                            className="w-full"
                        >
                            Entendido, ir a iniciar sesión
                        </ModalButton>
                    </>
                ) : (
                    <>
                        <ModalHeader
                            title={isLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                            description={isLogin ? 'Ingresa con tu correo o Google.' : 'Regístrate para acceder a tus consultas.'}
                            tone="info"
                            align="center"
                        />

                        {error && (
                            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
                                {error}
                            </div>
                        )}

                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {!isLogin && (
                                <div className="relative">
                                    <input
                                        type="text"
                                        aria-label="Nombre completo"
                                        autoComplete="name"
                                        placeholder="Nombre completo"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        required
                                        className={inputClass}
                                    />
                                </div>
                            )}

                            <div className="relative">
                                <input
                                    type="email"
                                    aria-label="Correo electrónico"
                                    autoComplete="email"
                                    placeholder="Correo electrónico"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className={inputClass}
                                />
                            </div>

                            <div className="relative">
                                <input
                                    type="password"
                                    aria-label="Contraseña"
                                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                                    placeholder="Contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className={inputClass}
                                />
                            </div>

                            <ModalButton type="submit" disabled={loading} variant="info" className="w-full">
                                {loading && <span className="material-icons-round animate-spin text-[18px]" aria-hidden="true">refresh</span>}
                                {isLogin ? 'Ingresar' : 'Registrarse'}
                            </ModalButton>
                        </form>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                            O continúa con
                            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                        </div>

                        <ModalButton onClick={handleGoogleLogin} disabled={loading} variant="secondary" className="w-full">
                            <img src="/logos/Google__G__logo.svg (1).png" alt="" className="h-5 w-5" />
                            {isLogin ? 'Iniciar sesión con Google' : 'Registrarse con Google'}
                        </ModalButton>

                        <div className="flex flex-col items-center gap-3">
                            {isLogin && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); handlePasswordReset(); }}
                                    className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-blue-300 dark:hover:bg-blue-950/30 dark:focus:ring-offset-slate-900"
                                >
                                    Olvidé mi contraseña
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setMode(isLogin ? 'register' : 'login')}
                                className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus:ring-offset-slate-900"
                            >
                                {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
