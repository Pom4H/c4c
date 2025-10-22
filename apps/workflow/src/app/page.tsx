"use client";

/**
 * Main page - redirect to executions list
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Home() {
	const router = useRouter();
	
	useEffect(() => {
		router.push("/executions");
	}, [router]);
	
	return (
		<main className="min-h-screen gradient-workflow flex items-center justify-center">
			<div className="text-center">
				<Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
				<p className="text-muted-foreground">Redirecting to executions...</p>
			</div>
		</main>
	);
}
