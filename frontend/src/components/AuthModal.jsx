import { useState, useEffect } from 'react';
import { auth, provider, signInWithPopup } from '../firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { toast } from 'sonner';
import Modal from './ui/Modal';

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
            toast.error("Por favor, ingresa tu correo electrónico en el campo superior.");
            setError("Ingresa tu correo antes de solicitar el cambio de contraseña.");
            return;
        }
        try {
            setLoading(true);
            await sendPasswordResetEmail(auth, email);
            toast.success("Correo de recuperación enviado. Revisa tu bandeja de entrada.");
            setError(null);
        } catch (err) {
            console.error(err);
            toast.error("Error al enviar el correo de recuperación.");
            setError("Error al enviar el correo. Verifica que esté bien escrito.");
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
                // Register
                const checkRes = await fetch(`/api/auth/check-disposable?email=${email}`);
                if (!checkRes.ok) {
                    const checkData = await checkRes.json();
                    throw new Error(checkData.detail || 'Email no válido');
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                // Use standard Firebase SDK email verification (in English/default template)
                await sendEmailVerification(userCredential.user);

                await signOut(auth); // Force Re-login to update emailVerified status
                setVerificationSent(true);
                return;
            } else {
                // Login
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    if (!userCredential.user.emailVerified) {
                        await signOut(auth);
                        throw new Error("Debes verificar tu correo. Revisa tu bandeja de entrada.");
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
                        throw new Error("Correo o contraseña incorrectos.");
                    }
                    throw loginErr;
                }
            }
        } catch (err) {
            console.error(err);
            let msg = err.message;
            if (msg.includes("auth/email-already-in-use")) msg = "El correo ya está registrado";
            if (msg.includes("auth/weak-password")) msg = "La contraseña es muy débil (mínimo 6 caracteres)";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" panelClassName="p-8">
            {/* Close Button */}
            <button
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
                <span className="material-icons-round" aria-hidden="true">close</span>
            </button>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-2">
                {verificationSent ? 'Verifica tu correo' : (isLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta')}
            </h2>

            {verificationSent && (
                <div className="text-center mt-6">
                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                        <span className="material-icons-round text-blue-600 dark:text-blue-300 text-3xl" aria-hidden="true">mark_email_read</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">
                        Hemos enviado un enlace de verificación a: <br /><strong>{email}</strong>
                        <br /><br />
                        Por favor, abre el enlace en tu correo para activar tu cuenta y luego inicia sesión.
                    </p>
                    <button
                        onClick={() => {
                            setVerificationSent(false);
                            setMode('login');
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-full shadow-lg transition-all"
                    >
                        Entendido, ir a Iniciar Sesión
                    </button>
                </div>
            )}

            {!verificationSent && (
                <>
                    <div className="h-4"></div>

                    {/* Error Message */}
                    {error && (
                        <div role="alert" className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg text-center">
                            {error}
                        </div>
                    )}

                    {/* Form Fields */}
                    <form className="space-y-4" onSubmit={handleSubmit}>

                        {!isLogin && (
                            <div className="space-y-1">
                                <div className="relative">
                                    <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" aria-hidden="true">person</span>
                                    <input
                                        type="text"
                                        aria-label="Nombre completo"
                                        placeholder="Nombre Completo"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        required={!isLogin}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg py-3 pl-10 pr-4 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <div className="relative">
                                <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" aria-hidden="true">email</span>
                                <input
                                    type="email"
                                    aria-label="Correo electrónico"
                                    placeholder="Correo Electrónico"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg py-3 pl-10 pr-4 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="relative">
                                <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" aria-hidden="true">lock</span>
                                <input
                                    type="password"
                                    aria-label="Contraseña"
                                    placeholder="Contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg py-3 pl-10 pr-10 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Action Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-full shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] mt-6 flex justify-center items-center gap-2"
                        >
                            {loading && <span className="material-icons-round animate-spin text-sm" aria-hidden="true">refresh</span>}
                            {isLogin ? 'Ingresar' : 'Registrarse'}
                        </button>
                    </form>

                    <div className="mt-4">
                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-200 dark:border-slate-700"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">O continúa con</span>
                            <div className="flex-grow border-t border-gray-200 dark:border-slate-700"></div>
                        </div>

                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium py-3 rounded-full transition-colors flex items-center justify-center gap-3 mt-2"
                        >
                            <img src="/logos/Google__G__logo.svg (1).png" alt="" className="w-5 h-5" />
                            {isLogin ? 'Iniciar sesión con Google' : 'Registrarse con Google'}
                        </button>
                    </div>

                    {/* Links */}
                    <div className="mt-6 flex flex-col items-center gap-4">
                        {isLogin && (
                            <button
                                onClick={(e) => { e.preventDefault(); handlePasswordReset(); }}
                                className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
                            >
                                Olvidé mi contraseña
                            </button>
                        )}

                        <button
                            onClick={() => setMode(isLogin ? 'register' : 'login')}
                            className="text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia Sesión'}
                        </button>
                    </div>
                </>
            )}
        </Modal>
    );
}
