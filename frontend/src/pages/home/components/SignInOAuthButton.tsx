import { useSignIn } from "@clerk/clerk-react"


const SignInOAuthButton = () => {
    const {signIn, isLoaded} = useSignIn();

    if (!isLoaded) {
        return null;
    }

    const signInWithGoogle = async () => {
        signIn.authenticateWithRedirect({
            strategy: "oauth_google",
            redirectUrl: "/sso-callback",
            redirectUrlComplete: "/auth-callback"
        });
    };

    return (
        <button  onClick={signInWithGoogle} className="px-2 py-4 bg-black text-white cursor-pointer">Continue with Google</button>
    )
}

export default SignInOAuthButton