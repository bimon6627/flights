export default function Footer() {
    const CURRENT_DATE = new Date()
    return (
        <div className="flex flex-col items-center justify-center bg-[#3c3c3c] md:p-8 p-5">
            <a href="https://bawm.no" className="font-bold md:text-3xl text-2xl tracking-tighter text-background dark:text-foreground">
            bawm<span className="text-secondary">.no</span>
            </a>
            <p className="text-xs text-background/70 dark:text-foreground/70">&copy; {CURRENT_DATE.getFullYear()} Birk Monsen</p>
        </div>
    )
}