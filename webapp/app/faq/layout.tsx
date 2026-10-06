import React from "react";

export default function FAQLayout({children,}: {children: React.ReactNode;}) {
    return(
        <div>
            <h1>FAQ Layout</h1>
            <div>{children}</div>
        </div>
    )
}