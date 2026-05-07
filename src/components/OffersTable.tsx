import type { FreightOffer } from '../types';

interface OffersTableProps {
  offers: FreightOffer[];
  onRowClick?: (offer: FreightOffer) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLoadingInfo(offer: FreightOffer) {
  const spot = offer.freight.spots.find((s) =>
    s.operations.some((o) => o.type === 'loading')
  );
  const op = spot?.operations.find((o) => o.type === 'loading');
  return {
    city: spot?.place.address.locality ?? '—',
    country: spot?.place.address.country?.replace(/^\d+_/, '') ?? '—',
    date: op?.local_timespan.begin ?? '',
  };
}

function getUnloadingInfo(offer: FreightOffer) {
  const spot = offer.freight.spots.find((s) =>
    s.operations.some((o) => o.type === 'unloading')
  );
  const op = spot?.operations.find((o) => o.type === 'unloading');
  return {
    city: spot?.place.address.locality ?? '—',
    country: spot?.place.address.country?.replace(/^\d+_/, '') ?? '—',
    date: op?.local_timespan.begin ?? '',
  };
}

export function OffersTable({ offers, onRowClick }: OffersTableProps) {
  if (offers.length === 0) {
    return <p className="no-data">No freight offers loaded yet.</p>;
  }

  return (
    <div className="table-container">
      <h3>📦 Available Freight Offers ({offers.length})</h3>
      <table className="offers-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Loading</th>
            <th>Loading Date</th>
            <th>Unloading</th>
            <th>Unloading Date</th>
            <th>Distance (km)</th>
            <th>Capacity (t)</th>
            <th>Price</th>
            <th>Company</th>
            <th>Rating</th>
            <th>Truck Type</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer, idx) => {
            const loading = getLoadingInfo(offer);
            const unloading = getUnloadingInfo(offer);
            const distKm = (offer.freight.route.distance || 0) / 1000;
            const price = offer.price.value
              ? `${offer.price.value} ${offer.price.currency.replace(/^\d+_/, '')}`
              : '—';
            const bodies =
              offer.freight.requirements.required_truck_bodies
                .map((b) => b.replace(/^\d+_/, '').replace(/_/g, ' '))
                .join(', ');

            return (
              <tr 
                key={offer.id}
                onClick={() => onRowClick?.(offer)}
                className={onRowClick ? 'clickable-row' : ''}
                title={onRowClick ? 'Клікніть щоб знайти на основній сторінці' : ''}
              >
                <td>{idx + 1}</td>
                <td>
                  <strong>{loading.city}</strong>
                  <br />
                  <small>{loading.country}</small>
                </td>
                <td>{loading.date ? formatDate(loading.date) : '—'}</td>
                <td>
                  <strong>{unloading.city}</strong>
                  <br />
                  <small>{unloading.country}</small>
                </td>
                <td>
                  {unloading.date ? formatDate(unloading.date) : '—'}
                </td>
                <td>{distKm.toFixed(0)}</td>
                <td>{offer.freight.capacity}</td>
                <td>{price}</td>
                <td>
                  <small>{offer.company.legal_name}</small>
                </td>
                <td>
                  ⭐ {offer.rating_summary.rate}/5
                  <br />
                  <small>({offer.rating_summary.rates_count})</small>
                </td>
                <td>
                  <small>{bodies}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
