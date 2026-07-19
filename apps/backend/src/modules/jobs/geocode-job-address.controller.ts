import { NextFunction, Request, Response } from 'express';
import { createForwardGeocoder } from './forward-geocode';
import { geocodeAddress } from './geocode-address';

const geocoder = createForwardGeocoder();

export async function geocodeJobAddressHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { addressLabel } = req.body as { addressLabel?: string };
    const result = await geocodeAddress(addressLabel, geocoder);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
