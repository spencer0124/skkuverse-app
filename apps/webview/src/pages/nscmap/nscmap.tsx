import nscMapImage from '../../assets/benzenmap.webp';

export default function NSCMap() {
  return (
    <div style={{ overflowX: 'auto', minHeight: '100vh' }} className="px-5 pt-5 pb-0">
      <img
        src={nscMapImage}
        alt="NSC Map"
        style={{ height: '95vh', width: 'auto', maxWidth: 'none', display: 'block' }}
      />
    </div>
  );
}
