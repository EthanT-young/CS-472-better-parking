"use client";

import dynamic from "next/dynamic";
import type { Status } from "../data/parking";

const GarageMap = dynamic(() => import("./GarageMap"), {
   ssr:false,
   loading: () => <p>Loading garage map...</p>,
});

export type GarageMapProps = {
   garageId: string;
   levelId: string;
   statuses: Record<string, Status>;
};

export default function GarageMapLoader(props: GarageMapProps) {
   return <GarageMap {...props} />;
}