"use client";

import dynamic from "next/dynamic";

const GarageMap = dynamic(() => import("./GarageMap"), {
   ssr:false,
   loading: () => <p>Loading garage map...</p>,
});

export type GarageMapProps = {
   garageId: string;
   levelId: string;
};

export default function GarageMapLoader(props: GarageMapProps) {
   return <GarageMap {...props} />;
}