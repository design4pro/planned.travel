import { Link } from "@tanstack/react-router";
import AuthForm from "../auth/AuthForm";

interface Props {
  mode: "signin" | "signup";
  language?: "en" | "pl";
}

const copy = {
  en: {
    signin: { title: "Sign in", subtitle: "Continue planning your next trip.", link: "Create an account" },
    signup: { title: "Create your account", subtitle: "Start planning trips together.", link: "Already have an account? Sign in" },
    email: "Email",
    password: "Password",
    submitSignin: "Sign in",
    submitSignup: "Sign up",
    or: "or",
    error: "Something went wrong. Please try again.",
    home: "planned.travel",
  },
  pl: {
    signin: { title: "Zaloguj się", subtitle: "Kontynuuj planowanie następnej podróży.", link: "Utwórz konto" },
    signup: { title: "Utwórz konto", subtitle: "Zacznij wspólnie planować podróże.", link: "Masz już konto? Zaloguj się" },
    email: "E-mail",
    password: "Hasło",
    submitSignin: "Zaloguj się",
    submitSignup: "Utwórz konto",
    or: "lub",
    error: "Coś poszło nie tak. Spróbuj ponownie.",
    home: "planned.travel",
  },
} as const;

export function AuthPage({ mode, language = "en" }: Props) {
  const labels = copy[language];
  const isSignin = mode === "signin";
  const home = language === "pl" ? "/pl" : "/";
  const alternate = language === "pl"
    ? (isSignin ? "/pl/signup" : "/pl/login")
    : (isSignin ? "/signup" : "/login");
  const heading = isSignin ? labels.signin : labels.signup;

  return (
    <main className="mx-auto min-h-screen max-w-sm px-6 py-16">
      <Link to={home} className="text-sm font-semibold text-primary underline">{labels.home}</Link>
      <h1 className="mt-10 text-3xl font-bold">{heading.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{heading.subtitle}</p>
      <div className="mt-8">
        <AuthForm
          mode={mode}
          labels={{
            email: labels.email,
            password: labels.password,
            submit: isSignin ? labels.submitSignin : labels.submitSignup,
            or: labels.or,
            genericError: labels.error,
          }}
        />
      </div>
      <Link to={alternate} className="mt-8 block text-center text-sm font-medium text-primary underline">
        {heading.link}
      </Link>
    </main>
  );
}
