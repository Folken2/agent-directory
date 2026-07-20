export type GuideShape = 'neighborhood' | 'itinerary' | 'comparison' | 'single';

export type GuidePlace = {
  id: string;
  name: string;
  mapsUrl?: string;
  placeId?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  hours?: string;
  openNow?: boolean;
  category?: string;
  summary?: string;
  mapsCaptureIndex?: number;
  lat?: number;
  lng?: number;
};

export type GuideSection = {
  id: string;
  title: string;
  placeIds: string[];
  blurb?: string;
};

export type GuideDocument = {
  shape: GuideShape;
  lead: string;
  sections: GuideSection[];
  places: GuidePlace[];
  sources?: { title: string; url: string }[];
};
